"""Read frozen antipodal magnitude targets without inventing missing thresholds."""
import math

def evaluate_antipodal(record, events, zone, distance, now):
    raw = record.get("targets")
    if raw is None:
        raw = [record["target"]] if "target" in record else []
    if not isinstance(raw, list) or not raw or any(
        isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v)
        for v in raw
    ):
        record.update(status="unverifiable", reason="Missing or invalid frozen magnitude targets", evaluated=now)
        return
    targets = sorted(set(raw))
    local = [e for e in events
             if record["start"] <= e["t"] < record["end"]
             and distance(zone[2], zone[3], e["lat"], e["lon"]) <= zone[4]]
    results = []
    for target in targets:
        hits = [{"id": e["id"], "m": e["m"], "t": e["t"]} for e in local if e["m"] >= target]
        results.append({"target": target, "hits": hits, "status": "response" if hits else "noResponse"})
    # Aggregate means response at ANY registered target, not at all magnitudes.
    record.update(target_results=results, hits=results[0]["hits"],
                  status=results[0]["status"], evaluated=now,
                  aggregate_rule="any_registered_target")
    record.pop("reason", None)
