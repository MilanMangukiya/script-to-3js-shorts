# Narration performance

## Analyze

Read the exact text, scene windows, pivotal visual times and current narration code. Identify the sentence's intention and the word or idea that changes the viewer's understanding. Diagnose flatness separately from casting: repeated sentence shapes, uniform speed, rushed pivots and long vacant gaps can make a capable voice feel dull.

Inspect what the engine actually accepts. In this pipeline `pacing_energy` selects a scene speed; optional `narration.performance.rate` explicitly overrides it. `delivery_note` is editorial intent. Do not assume prose directions such as "whisper urgently" are executed by Kokoro.

## Plan

Use contrast that serves the beat, rather than constant maximum urgency:

- Hook: direct address and immediate consequence, close and confident; make the surprising noun/verb easy to hear.
- Mechanism: clear causal wording, with enough space for unfamiliar terms or numbers.
- Escalation: tighten the next clause as the stakes change, then let the result register.
- Rehook or reversal: a brief pause can invite a prediction before the new information arrives. Protect the reveal's visual/audio timing.
- Human payoff: ease the pace when a small personal detail carries more meaning than a statistic.
- Loop bridge: leave forward momentum into the opening; avoid a detached sign-off.

These are choices, not a mandatory six-step emotional formula. In `delivery_note`, name the intended attention shift, key phrase and restraint in one useful sentence. Keep emphasis selective and the wording natural; punctuation supports phrasing but repeated ellipses/capitals are not a reliable emotion API.

Keep text and voice fixed for the first performance comparison. Choose a short interval containing a hook and a turn. Plan only a few decisive pauses, then measure WPM and scene fit rather than assuming the same rate yields the same cadence for every voice.

## Work

The schema supports optional `narration.performance`:

```json
{"rate": 1.06, "pauses": [{"after_word": 6, "duration_s": 0.30, "mode": "target"}]}
```

`rate` is absolute Kokoro speed (0.5-1.2; start near 1 and calibrate from the actual generated cadence). `after_word` is a 1-based token count in the exact text split on whitespace. Place it at a meaningful internal phrase boundary. `duration_s` is the gap after that token (0.05-0.6s); existing silence counts toward it. Default `mode: "minimum"` only extends the gap; `mode: "target"` also removes excessive silence when a sufficiently long continuous quiet region is verified. Indices must be unique and precede another word, with at most 1.2s of requested gaps in one scene.

The tool synthesizes the whole scene to preserve phrasing, then edits only verified quiet boundaries. It writes processed clips separately and regenerates them from original clips on every run. A pause that cannot be placed safely must fail with an actionable message; do not cut a consonant or guess an interpolated boundary. Do not split a normal scene into many tiny TTS utterances just to introduce pauses. First inspect natural gaps: adding a pause to an already hesitant line can make it duller.

Use `node tools/narrate.mjs <story.json> --out build/<review>/directed --reuse` for an isolated proof. `--speed` remains the fallback for scenes without `pacing_energy` or explicit `performance.rate`. New speed requires synthesis; pause changes rebuild processing from the base clips. Voice identity must agree with the cache before reuse.

Calibrate against fresh clips from the same installed engine/model. A cached clip's coarse model label and nominal speed are insufficient evidence of current cadence after engine or model changes. For a rate comparison, generate both rates with the current runner; keep unchanged source clips identical when comparing gap edits.

Keep every spoken word identical to `narration.text`. Preserve exact token order in captions and shift word times with inserted silence. Count pauses in duration; speech must finish within the declared narration end and leave the required scene margin. Correct overruns inside the authorized scope, rather than clipping speech or silently accelerating it. Keep scene timing and final music/mix fixed during a voice-only proof.

## Review

Compare baseline and directed samples at matched loudness with the same voice/text. Review the actual hook, pause, reversal and final syllable. Check intelligibility, pronunciation, listener effort, excessive hesitation, artificial cuts and whether the performance supports the visible reveal. Listening is needed to judge these qualities.

Also check real waveform gaps, duration/WPM, finite nonempty samples, headroom, exact recognized token coverage, ordered caption words and bounded word intervals that do not cross inserted silence. Inspect the real caption grouping separately: a phrase may remain visible for reading during a pause. ASR is evidence of recognition, not proof of pleasant tone. Interpolated words or repeated-token membership must not be counted as exact recognition.

Use deterministic unprompted recognition of the actual PCM WAV. Feeding the full expected script as Whisper's prompt can cause unrelated sign-offs on these short mechanism lines. A mismatch needs investigation, not forced captions or an automatic verdict against the voice. When recognition settings change, refresh recognition independently from the unchanged source speech.

Verify that changing voice/rate affects cache identity, changing pause rebuilds from the original clip, and repeated processing does not accumulate silence. Use the isolated output directory to preserve production artifacts. Record objective results, listening status and remaining limitations before moving to casting; never turn a successful synthesis into a claim of measured retention.
