/**
 * Unit tests for TOTM selection rules (artist uniqueness, ranking, ties, threshold).
 * Run: node scripts/test-totm-selection.mjs
 */

function compareTotmCandidates(a, b) {
  if (b.curatorScore !== a.curatorScore) return b.curatorScore - a.curatorScore
  const reviewDiff = new Date(a.reviewCreatedAt).getTime() - new Date(b.reviewCreatedAt).getTime()
  if (reviewDiff !== 0) return reviewDiff
  return new Date(a.submissionCreatedAt).getTime() - new Date(b.submissionCreatedAt).getTime()
}

function selectTotmTopTracks(candidates, max = 10) {
  const qualifying = candidates.filter((c) => c.curatorScore >= 8.5)
  const bestByArtist = new Map()
  for (const c of qualifying) {
    const existing = bestByArtist.get(c.twitchUserId)
    if (!existing || compareTotmCandidates(c, existing) < 0) {
      bestByArtist.set(c.twitchUserId, c)
    }
  }
  return Array.from(bestByArtist.values()).sort(compareTotmCandidates).slice(0, max)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function c(partial) {
  return {
    submissionId: partial.submissionId,
    userId: partial.userId || partial.twitchUserId,
    twitchUserId: partial.twitchUserId,
    curatorScore: partial.curatorScore,
    reviewCreatedAt: partial.reviewCreatedAt || '2026-03-10T12:00:00.000Z',
    submissionCreatedAt: partial.submissionCreatedAt || '2026-03-01T12:00:00.000Z',
    artistName: partial.artistName || null,
    songTitle: partial.songTitle || null,
    genre: null,
    audienceScore: partial.audienceScore ?? 9.9,
    soundcloudUrl: 'https://soundcloud.com/x/y',
  }
}

let passed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`✓ ${name}`)
  } catch (e) {
    console.error(`✗ ${name}`)
    console.error('  ', e.message)
    process.exitCode = 1
  }
}

test('excludes scores below 8.5', () => {
  const out = selectTotmTopTracks([
    c({ submissionId: '1', twitchUserId: 'a', curatorScore: 8.4 }),
    c({ submissionId: '2', twitchUserId: 'b', curatorScore: 8.5 }),
  ])
  assert(out.length === 1 && out[0].submissionId === '2', 'only 8.5+')
})

test('8.5 is entry floor — higher scores rank first', () => {
  const out = selectTotmTopTracks([
    c({ submissionId: 'floor', twitchUserId: 'a', curatorScore: 8.5 }),
    c({ submissionId: 'mid', twitchUserId: 'b', curatorScore: 9.0 }),
    c({ submissionId: 'top', twitchUserId: 'c', curatorScore: 9.8 }),
  ])
  assert(out.map((x) => x.submissionId).join(',') === 'top,mid,floor', 'highest first, 8.5 last')
})

test('one track per artist — highest score wins', () => {
  const out = selectTotmTopTracks([
    c({ submissionId: 'low', twitchUserId: 'a', curatorScore: 8.6 }),
    c({ submissionId: 'high', twitchUserId: 'a', curatorScore: 9.2 }),
    c({ submissionId: 'other', twitchUserId: 'b', curatorScore: 8.7 }),
  ])
  assert(out.length === 2, 'two artists')
  assert(out.find((x) => x.twitchUserId === 'a').submissionId === 'high', 'highest for artist a')
})

test('audience score never affects ranking', () => {
  const out = selectTotmTopTracks([
    c({
      submissionId: 'low-aud-high-cur',
      twitchUserId: 'a',
      curatorScore: 9.5,
      audienceScore: 1,
    }),
    c({
      submissionId: 'high-aud-low-cur',
      twitchUserId: 'b',
      curatorScore: 8.6,
      audienceScore: 10,
    }),
  ])
  assert(out[0].submissionId === 'low-aud-high-cur', 'curator score ranks first')
})

test('ties: earlier review timestamp wins', () => {
  const out = selectTotmTopTracks([
    c({
      submissionId: 'later',
      twitchUserId: 'a',
      curatorScore: 9.0,
      reviewCreatedAt: '2026-03-15T12:00:00.000Z',
    }),
    c({
      submissionId: 'earlier',
      twitchUserId: 'b',
      curatorScore: 9.0,
      reviewCreatedAt: '2026-03-10T12:00:00.000Z',
    }),
  ])
  assert(out[0].submissionId === 'earlier', 'earlier review first')
})

test('ties: earlier submission after equal review time', () => {
  const out = selectTotmTopTracks([
    c({
      submissionId: 'late-sub',
      twitchUserId: 'a',
      curatorScore: 9.0,
      reviewCreatedAt: '2026-03-10T12:00:00.000Z',
      submissionCreatedAt: '2026-03-05T12:00:00.000Z',
    }),
    c({
      submissionId: 'early-sub',
      twitchUserId: 'b',
      curatorScore: 9.0,
      reviewCreatedAt: '2026-03-10T12:00:00.000Z',
      submissionCreatedAt: '2026-03-01T12:00:00.000Z',
    }),
  ])
  assert(out[0].submissionId === 'early-sub', 'earlier submission first')
})

test('caps at 10 artists', () => {
  const many = []
  for (let i = 0; i < 15; i++) {
    many.push(
      c({
        submissionId: `s${i}`,
        twitchUserId: `u${i}`,
        curatorScore: 9.5 - i * 0.05,
      })
    )
  }
  const out = selectTotmTopTracks(many, 10)
  assert(out.length === 10, 'max 10')
  assert(out[0].twitchUserId === 'u0', 'highest first')
  assert(out[9].twitchUserId === 'u9', '10th is u9')
})

test('replacement: new higher track displaces lowest of top 10', () => {
  const base = []
  for (let i = 0; i < 10; i++) {
    base.push(
      c({
        submissionId: `old${i}`,
        twitchUserId: `u${i}`,
        curatorScore: 9.0 - i * 0.05,
      })
    )
  }
  const withNew = [
    ...base,
    c({ submissionId: 'new', twitchUserId: 'u99', curatorScore: 8.95 }),
  ]
  const out = selectTotmTopTracks(withNew, 10)
  assert(out.length === 10, 'still 10')
  assert(out.some((x) => x.submissionId === 'new'), 'new included')
  assert(!out.some((x) => x.submissionId === 'old9'), 'lowest displaced')
})

test('same artist multiple: only one slot even if both would rank high', () => {
  const out = selectTotmTopTracks([
    c({ submissionId: 'a1', twitchUserId: 'a', curatorScore: 9.9 }),
    c({ submissionId: 'a2', twitchUserId: 'a', curatorScore: 9.8 }),
    c({ submissionId: 'b1', twitchUserId: 'b', curatorScore: 8.5 }),
  ])
  assert(out.length === 2, 'two artists only')
  assert(out.filter((x) => x.twitchUserId === 'a').length === 1, 'artist a once')
})

console.log(`\n${passed} tests passed`)
