// Caption-timing checks shared by the renderer's audiovisual preview: every captioned word must have finite,
// ordered, non-overlapping times inside its clip, so burned-in captions follow the real speech.
export function assertCaptionTiming(record) {
  const words = record?.words, duration = record?.duration_s;
  if (!Array.isArray(words) || !words.length) throw new Error(`${record?.id}: no caption words`);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`${record.id}: invalid clip duration`);
  let previousEnd = 0;
  for (const [index, word] of words.entries()) {
    const { start_s: start, end_s: end } = word;
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error(`${record.id}: word ${index + 1} has non-finite timing`);
    if (start < -1e-6 || end > duration + 1e-6 || end < start) throw new Error(`${record.id}: word ${index + 1} (${word.text}) lies outside its clip or ends before it starts`);
    if (start < previousEnd - 1e-6) throw new Error(`${record.id}: word ${index + 1} (${word.text}) overlaps the previous word`);
    previousEnd = end;
  }
}
