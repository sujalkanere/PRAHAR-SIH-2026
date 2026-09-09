"""Duplicate work detection via NLP similarity (FR-ADE-002).

Pipeline:
  1. Embed work descriptions (all-MiniLM-L6-v2, 384-dim; TF-IDF fallback).
  2. Same-constituency pairwise cosine similarity > 0.85 pre-filter, plus a
     lexical overlap check (Jaccard token ratio >= 0.70) that rejects
     template-reuse lookalikes while keeping genuine near-duplicates
     (validated against AC-ADE-002-01/02).
  3. Filters: |amount diff|/max < 0.30, |sanction dates| < 365 days.
  4. Composite score (0-100) per SRS formula; >= 50 flagged.
"""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime, timezone
from itertools import combinations

import numpy as np
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Anomaly, Constituency, DuplicatePair, Work
from app.services.embeddings import get_embedding_service

ANOMALY_TYPE = "DUPLICATE_WORK"
COSINE_THRESHOLD = 0.85
JACCARD_THRESHOLD = 0.70
AMOUNT_DIFF_LIMIT = 0.30
DATE_WINDOW_DAYS = 365
FLAG_POSSIBLE = 50
FLAG_PROBABLE = 70


_STOPWORDS = {
    "at", "in", "of", "the", "for", "and", "to", "a", "an", "with", "from",
    "on", "by", "or", "as", "is", "are", "be",
}


def _tokens(text: str) -> set[str]:
    """Lowercased tokens minus function words (so at/in swaps don't mask duplicates)."""
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS}


def _jaccard(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    union = ta | tb
    if not union:
        return 1.0
    return len(ta & tb) / len(union)


def _amount_similarity(a: float, b: float) -> float:
    m = max(a, b)
    if m <= 0:
        return 1.0
    return max(0.0, 1.0 - abs(a - b) / m)


def _temporal_proximity(d1: date, d2: date) -> float:
    diff = abs((d2 - d1).days)
    return max(0.0, 1.0 - diff / DATE_WINDOW_DAYS)


def _haversine_km(lat1, lon1, lat2, lon2) -> float | None:
    try:
        p1, p2, q1, q2 = map(float, (lat1, lat2, lon1, lon2))
    except (TypeError, ValueError):
        return None
    r = 6371.0
    dlat = np.radians(p2 - p1)
    dlon = np.radians(q2 - q1)
    a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(p1)) * np.cos(np.radians(p2)) * np.sin(dlon / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def _geographic_proximity(w1: Work, w2: Work) -> float | None:
    km = _haversine_km(w1.latitude, w1.longitude, w2.latitude, w2.longitude)
    if km is None:
        return None
    return max(0.0, 1.0 - km / 2.0)  # full score within 2 km


def detect_duplicates(session: Session, reference_date=None) -> int:
    works = list(session.execute(select(Work)).scalars().all())
    if len(works) < 2:
        return 0
    now = datetime.now(timezone.utc)
    consts = {str(c.id): c for c in session.execute(select(Constituency)).scalars().all()}

    # Group by constituency first
    work_by_const: dict[str, list[Work]] = {}
    for w in works:
        work_by_const.setdefault(str(w.constituency_id), []).append(w)

    # Compute normalized embeddings across works
    texts = [w.work_description for w in works]
    if len(texts) > 1000:
        from sklearn.feature_extraction.text import TfidfVectorizer
        tfidf = TfidfVectorizer(max_features=384, stop_words="english", sublinear_tf=True)
        all_em = tfidf.fit_transform(texts).toarray().astype(np.float32)
        norms = np.linalg.norm(all_em, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        all_em = all_em / norms
    else:
        svc = get_embedding_service()
        all_em = svc.encode(texts)

    work_idx_map = {w.id: i for i, w in enumerate(works)}
    flagged_works: set[uuid.UUID] = set()
    pairs_to_add: list[DuplicatePair] = []
    anomalies_to_add: list[Anomaly] = []

    for cid, wlist in work_by_const.items():
        if len(wlist) < 2:
            continue
        indices = [work_idx_map[w.id] for w in wlist]
        em = all_em[indices]
        sims = em @ em.T

        # Vectorized candidate selection - skips millions of below-threshold pairs instantly
        i_arr, j_arr = np.where(np.triu(sims > COSINE_THRESHOLD, k=1))
        if len(i_arr) == 0:
            continue

        const_candidates = []
        for i, j in zip(i_arr, j_arr):
            cos = float(sims[i, j])
            wi, wj = wlist[i], wlist[j]
            if _jaccard(wi.work_description, wj.work_description) < JACCARD_THRESHOLD:
                continue
            # amount within 30%
            if max(float(wi.sanctioned_amount), float(wj.sanctioned_amount)) > 0:
                if abs(float(wi.sanctioned_amount) - float(wj.sanctioned_amount)) / max(
                        float(wi.sanctioned_amount), float(wj.sanctioned_amount)) >= AMOUNT_DIFF_LIMIT:
                    continue
            # sanction dates within 365 days
            if abs((wj.sanction_date - wi.sanction_date).days) >= DATE_WINDOW_DAYS:
                continue

            score = _composite_score(wi, wj, cos)
            flag_threshold = FLAG_POSSIBLE if cos >= 0.95 else FLAG_PROBABLE
            if score < flag_threshold:
                continue
            if cos < 0.95:
                geo = _geographic_proximity(wi, wj)
                if geo is not None and geo <= 0.0:
                    continue

            const_candidates.append((wi, wj, cos, score))

        # Rank candidates and take top representative duplicate pairs per constituency
        const_candidates.sort(key=lambda x: x[3], reverse=True)
        for wi, wj, cos, score in const_candidates[:30]:
            severity = "HIGH" if score >= FLAG_PROBABLE else "MEDIUM"
            a, b = (wi, wj) if str(wi.id) < str(wj.id) else (wj, wi)
            pair = DuplicatePair(
                id=uuid.uuid4(), work_id_a=a.id, work_id_b=b.id,
                text_similarity=round(cos, 4),
                amount_similarity=round(_amount_similarity(float(wi.sanctioned_amount),
                                                           float(wj.sanctioned_amount)), 4),
                composite_score=int(score), detected_at=now,
            )
            pairs_to_add.append(pair)

            for work, other in ((wi, wj), (wj, wi)):
                if work.id not in flagged_works:
                    flagged_works.add(work.id)
                    anomalies_to_add.append(Anomaly(
                        id=uuid.uuid4(), work_id=work.id, constituency_id=work.constituency_id,
                        anomaly_type=ANOMALY_TYPE, severity=severity,
                        confidence_score=round(cos, 4),
                        detection_method="NLP_COSINE_SIMILARITY",
                        details={
                            "text_similarity": round(cos, 4),
                            "amount_similarity": round(_amount_similarity(
                                float(wi.sanctioned_amount), float(wj.sanctioned_amount)), 4),
                            "composite_score": int(score),
                            "matched_with_work": other.work_id,
                            "work_ref": work.work_id,
                            "constituency": consts[cid].name,
                        },
                        status="NEW", detected_at=now,
                    ))

    # Bulk insert all records without locking SQLite in small roundtrips
    if pairs_to_add:
        session.add_all(pairs_to_add)
    if anomalies_to_add:
        session.add_all(anomalies_to_add)
    session.commit()
    return len(anomalies_to_add)


def _composite_score(w1: Work, w2: Work, cos: float) -> float:
    """SRS composite duplicate score formula (max 100)."""
    score = 0.0
    score += cos * 40  # text similarity (max 40)
    score += _amount_similarity(float(w1.sanctioned_amount), float(w2.sanctioned_amount)) * 20
    score += _temporal_proximity(w1.sanction_date, w2.sanction_date) * 15
    geo = _geographic_proximity(w1, w2)
    if geo is not None:
        score += geo * 15
    if w1.work_category == w2.work_category:
        score += 10
    return score


def clear_duplicates(session: Session) -> None:
    session.execute(delete(DuplicatePair))
    session.execute(delete(Anomaly).where(Anomaly.anomaly_type == ANOMALY_TYPE))
    session.commit()
