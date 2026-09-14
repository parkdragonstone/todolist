import { describe, expect, it } from 'vitest'

import { formatBytes, formatShortDate } from './format'
import { mondayIndex, moveItem, repeatLabel, toggleId } from './task'

describe('repeatLabel', () => {
  it('describes each frequency', () => {
    expect(repeatLabel(null)).toBe('안 함')
    expect(repeatLabel({ freq: 'daily' })).toBe('매일')
    expect(repeatLabel({ freq: 'weekly', interval: 1, weekdays: [4] })).toBe('매주 · 금')
    expect(repeatLabel({ freq: 'weekly', interval: 2, weekdays: [0, 2] })).toBe('2주마다 · 월·수')
    expect(repeatLabel({ freq: 'monthly', interval: 3 })).toBe('3개월마다')
    expect(repeatLabel({ freq: 'yearly', interval: 1, weekdays: null })).toBe('매년')
  })
})

describe('list helpers', () => {
  it('toggles ids', () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3])
    expect(toggleId([1, 2, 3], 2)).toEqual([1, 3])
  })

  it('moves items within bounds', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c'])
  })

  it('maps weekday to Monday-based index', () => {
    expect(mondayIndex(new Date(2026, 8, 14))).toBe(0)
    expect(mondayIndex(new Date(2026, 8, 20))).toBe(6)
  })
})

describe('format', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(53_248)).toBe('52 KB')
    expect(formatBytes(3_500_000)).toBe('3.3 MB')
  })

  it('formats short dates with Korean weekday', () => {
    expect(formatShortDate('2026-09-25')).toBe('9/25(금)')
  })
})
