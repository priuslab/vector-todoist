export const ANALYSIS_PROMPT_VERSION = 'analyze-brain-dump.v2';

export const analyzeBrainDumpPrompt = (brainDumpText: string, answers: Array<{ id: string; text: string }> = [], repair = false): string => {
  const answerContext = answers.length > 0 ? `\nВідповіді користувача:\n${answers.map((answer) => `${answer.id}: ${answer.text}`).join('\n')}` : '';
  const repairInstruction = repair ? '\nПопередня відповідь була невалідною. Поверни лише валідний JSON за схемою.' : '';
  return `Ти — Вектор, спокійний український AI-асистент планування. Проаналізуй Brain Dump і поверни лише валідний JSON без markdown, пояснень або додаткових ключів. Не створюй задачі в базі даних.

Усі поля summary, confidence, questions, tasks, ideas і context обов’язкові. Поверни об’єкт саме такої форми:
{
  "summary": "короткий підсумок",
  "confidence": 0.0,
  "questions": [{ "id": "q1", "text": "критичне уточнення", "field": "goal_or_constraint" }],
  "tasks": [{ "title": "дія", "description": "деталь", "priority": "high", "estimatedMinutes": 30, "deadline": null, "energy": "medium", "confidence": 0.0 }],
  "ideas": [{ "text": "ідея", "summary": "коротко", "confidence": 0.0 }],
  "context": ["важливий факт"]
}
Правила: confidence — число від 0 до 1; максимум одне критичне question; field: короткий ідентифікатор поля з латинських літер, цифр, _, - або .; estimatedMinutes — ціле додатне число; deadline: ISO datetime з часовим поясом або null. Допустимі priority: "low", "medium", "high", "urgent". Допустимі energy: "low", "medium", "high". Не вигадуй дедлайни — за замовчуванням null. Якщо задач чи ідей немає, поверни порожній масив. Ideas залишаються в backlog.

Brain Dump:
${brainDumpText}${answerContext}${repairInstruction}`;
};
