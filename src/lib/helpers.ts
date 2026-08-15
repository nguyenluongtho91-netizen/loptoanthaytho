import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { Role } from '@/types'

export const fmt = (date: string | Date | null | undefined, pattern = 'dd/MM/yyyy'): string =>
  date ? format(new Date(date), pattern, { locale: vi }) : '—'

export const fmtVND = (amount: number | null | undefined): string =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
    .format(amount ?? 0)

export const fmtVNDShort = (amount: number | null | undefined): string =>
  new Intl.NumberFormat('vi-VN').format(amount ?? 0) + ' đ'

/** Count working/class days in a month given days-of-week (0=Sun…6=Sat) */
export function countDaysInMonth(year: number, month: number, weekdays: number[] = []): number {
  const days = eachDayOfInterval({
    start: startOfMonth(new Date(year, month - 1)),
    end:   endOfMonth(new Date(year, month - 1)),
  })
  return days.filter(d => weekdays.includes(getDay(d))).length
}

/** Derive planned sessions from schedule string like "2,5" (Thu, Sun) */
export function parseSchedule(scheduleStr: string | null | undefined): number[] {
  if (!scheduleStr) return []
  return scheduleStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
}

export interface ScheduleDay {
  day: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  time: string // e.g. "2h30-4h30"
}

/** Parse Vietnamese user input schedule like "Thứ 2 (18h-20h), Thứ 5 (17h-19h)" */
export function parseScheduleToDays(scheduleStr: string | null | undefined): ScheduleDay[] {
  if (!scheduleStr) return []
  
  const str = scheduleStr.trim().toLowerCase()
  if (!str) return []

  const dayKeywords = [
    { keys: ['chủ nhật', 'chủn nhật', 'cn', 'c.n', 'sunday'], value: 0 },
    { keys: ['thứ 2', 'thứ hai', 't2', 't.2', 'monday'], value: 1 },
    { keys: ['thứ 3', 'thứ ba', 't3', 't.3', 'tuesday'], value: 2 },
    { keys: ['thứ 4', 'thứ tư', 't4', 't.4', 'wednesday'], value: 3 },
    { keys: ['thứ 5', 'thứ năm', 't5', 't.5', 'thursday'], value: 4 },
    { keys: ['thứ 6', 'thứ sáu', 't6', 't.6', 'friday'], value: 5 },
    { keys: ['thứ 7', 'thứ bảy', 't7', 't.7', 'saturday'], value: 6 }
  ]

  interface DayMatch {
    day: number
    index: number
    length: number
  }

  const foundDays: DayMatch[] = []

  for (const group of dayKeywords) {
    for (const key of group.keys) {
      let index = str.indexOf(key)
      while (index !== -1) {
        const isDuplicate = foundDays.some(fd => fd.index <= index && index < fd.index + fd.length)
        if (!isDuplicate) {
          foundDays.push({
            day: group.value,
            index: index,
            length: key.length
          })
        }
        index = str.indexOf(key, index + 1)
      }
    }
  }

  foundDays.sort((a, b) => a.index - b.index)

  const timeRegex = /(\d{1,2}\s*[h:]\s*\d{0,2}\s*(?:-|–|đến)\s*\d{1,2}\s*[h:]\s*\d{0,2})/g
  
  interface TimeMatch {
    time: string
    index: number
    length: number
  }

  const foundTimes: TimeMatch[] = []
  let match
  while ((match = timeRegex.exec(str)) !== null) {
    foundTimes.push({
      time: match[1].trim(),
      index: match.index,
      length: match[1].length
    })
  }

  if (foundTimes.length === 0) {
    return foundDays.map(fd => ({ day: fd.day, time: '' }))
  }

  return foundDays.map((fd, i) => {
    if (foundTimes.length === 1) {
      return { day: fd.day, time: foundTimes[0].time }
    }

    const nextDayIndex = i < foundDays.length - 1 ? foundDays[i + 1].index : Infinity
    const matchingTime = foundTimes.find(ft => ft.index >= fd.index && ft.index < nextDayIndex)

    if (matchingTime) {
      return { day: fd.day, time: matchingTime.time }
    }

    let closestTime = foundTimes[0]
    let minDiff = Math.abs(foundTimes[0].index - fd.index)
    for (const ft of foundTimes) {
      const diff = Math.abs(ft.index - fd.index)
      if (diff < minDiff) {
        minDiff = diff
        closestTime = ft
      }
    }
    return { day: fd.day, time: closestTime ? closestTime.time : '' }
  })
}

interface CalcTuitionParams {
  feePerSession: number
  plannedSessions: number
  absences: number
}

/** Calculate tuition for a student in a class for a given month */
export function calcTuition({ feePerSession, plannedSessions, absences }: CalcTuitionParams): number {
  const attended = Math.max(0, plannedSessions - absences)
  return attended * feePerSession
}

export const roleLabel: Record<Role, string> = {
  ADMIN:   'Quản trị',
  TEACHER: 'Giáo viên',
  TA:      'Trợ giảng',
}

export const statusColor: Record<string, string> = {
  active:   'bg-teal-100 text-teal-800',
  inactive: 'bg-gray-100 text-gray-600',
  paid:     'bg-green-100 text-green-800',
  debt:     'bg-red-100 text-red-700',
}

export function classInitials(name: string | null | undefined): string {
  return name?.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? '??'
}

export function generateStudentCode(index: number): string {
  return `HS${String(index).padStart(3, '0')}`
}

export const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const

/** Convert a string to Title Case (capitalizing only the first letter of each word) */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return ''
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
