import type { TelegramInlineButton } from '../../integrations/telegram/telegramClient.js';

export type TelegramMessage = { text: string; inlineKeyboard?: TelegramInlineButton[][] };

export function morningPlanTemplate(input: { date: string; tasks: Array<{ title: string; time?: string }> }): TelegramMessage {
  const rows = input.tasks.length ? input.tasks.map((task) => `• ${task.time ? `${task.time} — ` : ''}${task.title}`) : ['Сьогодні в плані немає обов’язкових задач.'];
  return { text: `Доброго ранку, Олено 🌿\n\nТвій спокійний план на ${input.date}:\n${rows.join('\n')}\n\nОбери один наступний крок — цього достатньо для старту.`, inlineKeyboard: [[{ text: 'Відкрити план', callbackData: 'open_plan:today' }]] };
}

export function eveningReviewTemplate(input: { date: string; completed: number; remaining: number }): TelegramMessage {
  return { text: `Вечірній підсумок за ${input.date}\n\nВиконано: ${input.completed}. Залишилось: ${input.remaining}.\n\nПлан можна спокійно продовжити завтра — без оцінок і поспіху.`, inlineKeyboard: [[{ text: 'Відкрити підсумок', callbackData: 'open_review:today' }]] };
}

export function taskReminderTemplate(input: { title: string; time?: string }): TelegramMessage {
  return { text: `Нагадування: ${input.title}${input.time ? ` о ${input.time}` : ''}.\n\nМожна почати з найменшого кроку.`, inlineKeyboard: [[{ text: 'Відкрити задачу', callbackData: 'open_task:current' }]] };
}

export function overdueTemplate(input: { title: string }): TelegramMessage {
  return { text: `Задача «${input.title}» потребує нового місця в плані.\n\nВектор допоможе знайти реалістичний час.`, inlineKeyboard: [[{ text: 'Перепланувати', callbackData: 'reschedule:current' }]] };
}

export function rescheduleTemplate(input: { count: number; changeSetId: string }): TelegramMessage {
  return { text: `План змінився — я знайшов новий час.\n\n${input.count} ${input.count === 1 ? 'задача потребує' : 'задач потребують'} нового місця в плані.`, inlineKeyboard: [[{ text: 'Відкрити план', callbackData: 'open_plan:today' }, { text: 'Undo', callbackData: `undo:${input.changeSetId}` }]] };
}

