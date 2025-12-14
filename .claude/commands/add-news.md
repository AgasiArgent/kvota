# Add News Entry

Creates a new news entry for the Kvota app.

## Workflow

1. Ask user for news content
2. Generate markdown file
3. Update index.json
4. Ready for commit

## Execution

### Step 1: Gather Information

Use AskUserQuestion to ask:

**Question 1: Title**
- "Заголовок новости (короткий, 3-7 слов):"
- Open-ended

**Question 2: Content**
- "Опишите изменения/новую функцию:"
- Open-ended (will be formatted into markdown)

### Step 2: Generate Files

After gathering information:

1. Generate filename: `YYYY-MM-DD-{slugified-title}.md`
2. Create markdown file with frontmatter:

```markdown
---
title: "{title}"
date: "YYYY-MM-DD"
---

{formatted content}
```

3. Update `frontend/public/news/index.json`:
   - Read current index
   - Add new entry at the beginning
   - Write updated index

### Step 3: Confirm

Show user:
```
Created news entry:
- File: frontend/public/news/YYYY-MM-DD-{slug}.md
- Title: {title}
- Date: {date}

Ready to commit? The news will appear in the app after deploy.
```

## Content Formatting Tips

When writing content:
- Start with a brief summary paragraph
- Use `## Что нового` for feature highlights
- Use `## Как использовать` for usage instructions
- Use bullet lists for multiple items
- Keep language simple and in Russian

## Example

**Input:**
- Title: "Поиск клиентов по названию"
- Content: "Добавлена возможность искать клиентов не только по ИНН, но и по названию компании. Работает с частичным совпадением."

**Output file:** `2025-12-14-search-customers-by-name.md`

```markdown
---
title: "Поиск клиентов по названию"
date: "2025-12-14"
---

Добавлена возможность искать клиентов не только по ИНН, но и по названию компании.

## Что нового

- Поиск по частичному совпадению названия
- Работает одновременно с поиском по ИНН
- Результаты обновляются в реальном времени

## Как использовать

1. Откройте страницу клиентов
2. Начните вводить название компании в поле поиска
3. Результаты отфильтруются автоматически
```

ARGUMENTS: $ARGUMENTS
