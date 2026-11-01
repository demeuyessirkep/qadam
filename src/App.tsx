import { useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase'

type Task = {
  id: number
  dbId?: string
  title: string
  category: string
  date: string
  time: string
  done: boolean
}

type Goal = {
  id: number
  dbId?: string
  title: string
  target: number
  current: number
}

type Theme = 'light' | 'dark'

const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function loadData<T,>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as T) : fallback
  } catch {
    return fallback
  }
}

function App() {
  const [page, setPage] = useState('home')

  const [theme, setTheme] = useState<Theme>(() =>
    loadData<Theme>('qadam-theme', 'light'),
  )

  const [tasks, setTasks] = useState<Task[]>(() =>
    loadData<Task[]>('qadam-tasks-v2', []),
  )

  const [goals, setGoals] = useState<Goal[]>(() =>
    loadData<Goal[]>('qadam-goals', []),
  )

  const [selectedDate, setSelectedDate] = useState(today())
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Оқу')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState('09:00')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalTarget, setGoalTarget] = useState(10)
  const [search, setSearch] = useState('')

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Қонақ аккаунтына кіру
  useEffect(() => {
    const signInGuest = async () => {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError) {
        console.error('Сессия қатесі:', sessionError.message)
        return
      }

      if (sessionData.session) {
        console.log('Қонақ сессиясы бар.')
        return
      }

      const { data: guestData, error: guestError } =
        await supabase.auth.signInAnonymously()

      if (guestError) {
        console.error('Қонақ ретінде кіру қатесі:', guestError.message)
        return
      }

      console.log('Қонақ аккаунты құрылды:', guestData.user?.id)
    }

    signInGuest()
  }, [])

  // Supabase-тен тапсырмалар мен мақсаттарды жүктеу
  useEffect(() => {
    const loadDataFromSupabase = async () => {
      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (userError || !userData.user) {
        console.error('Пайдаланушы қатесі:', userError?.message)
        return
      }

      const userId = userData.user.id

      const { data: taskData, error: taskError } = await supabase
        .from('plans')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })

      if (taskError) {
        console.error('Тапсырмаларды жүктеу қатесі:', taskError.message)
        return
      }

      const loadedTasks: Task[] = taskData.map((item) => ({
        id: Date.now() + Math.random(),
        dbId: item.id,
        title: item.title,
        category: item.category,
        date: item.task_date,
        time: item.task_time,
        done: item.completed,
      }))

      setTasks(loadedTasks)

      const { data: goalData, error: goalError } = await supabase
        .from('user_goals')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })

      if (goalError) {
        console.error('Мақсаттарды жүктеу қатесі:', goalError.message)
        return
      }

      const loadedGoals: Goal[] = goalData.map((item) => ({
        id: Date.now() + Math.random(),
        dbId: item.id,
        title: item.title,
        target: item.target,
        current: item.current,
      }))

      setGoals(loadedGoals)
    }

    loadDataFromSupabase()
  }, [])

  // Деректерді браузерде сақтау
  useEffect(() => {
    localStorage.setItem('qadam-tasks-v2', JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    localStorage.setItem('qadam-goals', JSON.stringify(goals))
  }, [goals])

  // Тақырып режимін сақтау
  useEffect(() => {
    localStorage.setItem('qadam-theme', JSON.stringify(theme))
  }, [theme])

  const completed = tasks.filter((task) => task.done).length

  const progress = tasks.length
    ? Math.round((completed / tasks.length) * 100)
    : 0

  const todaysTasks = tasks.filter((task) => task.date === selectedDate)

  const filteredTasks = todaysTasks.filter((task) =>
    task.title.toLowerCase().includes(search.toLowerCase()),
  )

  // Тапсырма қосу
  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return

    const task: Task = {
      id: Date.now(),
      title: title.trim(),
      category,
      date,
      time,
      done: false,
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser()

    if (userError || !userData.user) {
      console.error('Пайдаланушы табылмады:', userError?.message)
      alert('Қонақ аккаунты әлі дайын емес. Бетті жаңартып көр.')
      return
    }

    const { data: savedTask, error } = await supabase
      .from('plans')
      .insert({
        owner_id: userData.user.id,
        title: task.title,
        category: task.category,
        task_date: task.date,
        task_time: task.time,
        completed: task.done,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase сақтау қатесі:', error.message)
      alert('Тапсырманы базаға сақтау мүмкін болмады.')
      return
    }

    setTasks((previous) => [
      ...previous,
      { ...task, dbId: savedTask.id },
    ])

    setTitle('')
  }

  // Тапсырманы орындау немесе орындамау
  async function toggleTask(id: number) {
    const task = tasks.find((item) => item.id === id)

    if (!task) return

    const newDone = !task.done

    if (task.dbId) {
      const { error } = await supabase
        .from('plans')
        .update({ completed: newDone })
        .eq('id', task.dbId)

      if (error) {
        console.error('Тапсырманы жаңарту қатесі:', error.message)
        alert('Тапсырманы жаңарту мүмкін болмады.')
        return
      }
    }

    setTasks((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, done: newDone } : item,
      ),
    )
  }

  // Тапсырманы өшіру
  async function deleteTask(id: number) {
    const task = tasks.find((item) => item.id === id)
    if (!task) return

    if (task.dbId) {
      const { error } = await supabase
        .from('plans')
        .delete()
        .eq('id', task.dbId)

      if (error) {
        console.error('Тапсырманы өшіру қатесі:', error.message)
        alert('Тапсырманы өшіру мүмкін болмады.')
        return
      }
    }

    setTasks((previous) =>
      previous.filter((item) => item.id !== id),
    )
  }

  // Мақсат қосу
  async function addGoal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!goalTitle.trim()) return

    const { data: userData, error: userError } =
      await supabase.auth.getUser()

    if (userError || !userData.user) {
      console.error('Пайдаланушы қатесі:', userError?.message)
      alert('Аккаунт табылмады.')
      return
    }

    const { data: savedGoal, error } = await supabase
      .from('user_goals')
      .insert({
        owner_id: userData.user.id,
        title: goalTitle.trim(),
        target: goalTarget,
        current: 0,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Мақсатты сақтау қатесі:', error.message)
      alert('Мақсатты базаға сақтау мүмкін болмады.')
      return
    }

    setGoals((previous) => [
      ...previous,
      {
        id: Date.now(),
        dbId: savedGoal.id,
        title: goalTitle.trim(),
        target: goalTarget,
        current: 0,
      },
    ])

    setGoalTitle('')
    setGoalTarget(10)
  }

  // Мақсат қадамдарын өзгерту
  async function changeGoal(id: number, amount: number) {
    const goal = goals.find((item) => item.id === id)

    if (!goal) return

    const newCurrent = Math.max(
      0,
      Math.min(goal.target, goal.current + amount),
    )

    if (goal.dbId) {
      const { error } = await supabase
        .from('user_goals')
        .update({ current: newCurrent })
        .eq('id', goal.dbId)

      if (error) {
        console.error('Мақсатты жаңарту қатесі:', error.message)
        alert('Мақсатты жаңарту мүмкін болмады.')
        return
      }
    }

    setGoals((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, current: newCurrent } : item,
      ),
    )
  }

  // Мақсатты өшіру
  async function deleteGoal(id: number) {
    const goal = goals.find((item) => item.id === id)
    if (!goal) return

    if (goal.dbId) {
      const { error } = await supabase
        .from('user_goals')
        .delete()
        .eq('id', goal.dbId)

      if (error) {
        console.error('Мақсатты өшіру қатесі:', error.message)
        alert('Мақсатты өшіру мүмкін болмады.')
        return
      }
    }

    setGoals((previous) =>
      previous.filter((item) => item.id !== id),
    )
  }

  // Мақсат атауын өзгерту
  async function editGoal(id: number) {
    const goal = goals.find((item) => item.id === id)
    if (!goal) return

    const newTitle = window.prompt('Мақсаттың жаңа атауы:', goal.title)

    if (!newTitle?.trim() || newTitle.trim() === goal.title) return

    if (goal.dbId) {
      const { error } = await supabase
        .from('user_goals')
        .update({ title: newTitle.trim() })
        .eq('id', goal.dbId)

      if (error) {
        console.error('Мақсатты өзгерту қатесі:', error.message)
        alert('Мақсатты өзгерту мүмкін болмады.')
        return
      }
    }

    setGoals((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, title: newTitle.trim() }
          : item,
      ),
    )
  }

  function changeMonth(amount: number) {
    setCalendarMonth(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + amount,
          1,
        ),
    )
  }

  const monthName = new Intl.DateTimeFormat('kk-KZ', {
    month: 'long',
    year: 'numeric',
  }).format(calendarMonth)

  const firstWeekday =
    (new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ).getDay() +
      6) %
    7

  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0,
  ).getDate()

  const calendarDays = [
    ...Array.from({ length: firstWeekday }, () => 0),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  const pageTitles: Record<string, string> = {
    home: 'Бүгінгі күніңді жоспарла',
    plans: 'Менің жоспарларым',
    calendar: 'Күнтізбе',
    goals: 'Менің мақсаттарым',
    stats: 'Менің статистикам',
  }

  return (
    <div className={`qadam-app ${theme}-mode`}>
      <aside className="sidebar">
        <a
          className="logo"
          href="#home"
          onClick={() => setPage('home')}
        >
          <span className="logo-mark">✦</span>
          <span>
            QADAM
            <small>Жоспарла. Дами бер.</small>
          </span>
        </a>

        <div className="sidebar-label">НЕГІЗГІ МӘЗІР</div>

        <nav className="navigation" aria-label="Негізгі мәзір">
          {[
            ['home', '⌂', 'Басты бет'],
            ['plans', '▤', 'Жоспарлар'],
            ['calendar', '▦', 'Күнтізбе'],
            ['goals', '◎', 'Мақсаттар'],
            ['stats', '▥', 'Статистика'],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-orb">✧</div>
          <p>Үлкен мақсаттар кішкентай қадамнан басталады.</p>
          <span>Өзіңе сен. Алға қадам бас.</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Qadam / Жеке кеңістік</div>

          <label className="search-box">
            <span>⌕</span>
            <input
              placeholder="Жоспарлардан іздеу..."
              aria-label="Тапсырмалардан іздеу"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="profile">
            <button
              className="theme-toggle"
              type="button"
              onClick={() =>
                setTheme((previous) =>
                  previous === 'light' ? 'dark' : 'light',
                )
              }
              aria-label="Түстер режимін ауыстыру"
            >
              {theme === 'light' ? '🌙 Қараңғы режим' : '☀️ Жарық режим'}
            </button>

            <span className="profile-avatar">Q</span>
            <span>Менің кеңістігім</span>
          </div>
        </header>

        <section className="welcome-section">
          <div className="welcome-copy">
            <div className="welcome-label">
              <span className="live-dot" />
              ЖАҢА КҮН · ЖАҢА МҮМКІНДІК
            </div>

            <h1>
              {pageTitles[page]}
              <span>.</span>
            </h1>

            <p>
              Ойыңды жаз, жоспарыңды құр және арманыңа қарай
              күн сайын қадам жаса.
            </p>

            <button
              className="welcome-link"
              onClick={() => setPage('plans')}
            >
              ＋ Жоспарларыма өту
            </button>
          </div>

          <div className="hero-art" aria-hidden="true">
            <div className="hero-moon" />
            <div className="hero-mountain mountain-back" />
            <div className="hero-mountain mountain-front" />
            <div className="hero-star star-one">✦</div>
            <div className="hero-star star-two">✧</div>
            <div className="hero-caption">ONE STEP AT A TIME</div>
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-heading">
              <span className="stat-icon purple">▤</span>
              Барлық тапсырма
            </div>
            <strong>{tasks.length}</strong>
            <small>Жоспарларыңның саны</small>
          </article>

          <article className="stat-card">
            <div className="stat-heading">
              <span className="stat-icon green">✓</span>
              Орындалған
            </div>
            <strong>{completed}</strong>
            <small>Жарайсың, алға!</small>
          </article>

          <article className="stat-card">
            <div className="stat-heading">
              <span className="stat-icon blue">◉</span>
              Жалпы прогресс
            </div>
            <strong>{progress}%</strong>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </article>
        </section>

        {page === 'home' && (
          <section className="workspace">
            <div className="tasks-panel panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">БҮГІНГІ КҮН</span>
                  <h2>Бүгінгі жоспарлар</h2>
                </div>
                <button
                  className="small-action"
                  onClick={() => setPage('plans')}
                >
                  Барлығын көру →
                </button>
              </div>

              <p className="muted-text">
                {new Intl.DateTimeFormat('kk-KZ', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(`${today()}T12:00:00`))}
              </p>

              {tasks.filter((task) => task.date === today()).length === 0 ? (
                <div className="empty-state">
                  <span>✧</span>
                  <p>Бүгінге жоспар әлі жоқ.</p>
                  <button
                    className="add-button"
                    onClick={() => setPage('plans')}
                  >
                    ＋ Жоспар қосу
                  </button>
                </div>
              ) : (
                tasks
                  .filter((task) => task.date === today())
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((task) => (
                    <div className="task-row" key={task.id}>
                      <button
                        className={`task-check ${task.done ? 'checked' : ''}`}
                        onClick={() => toggleTask(task.id)}
                        aria-label="Тапсырма күйін өзгерту"
                      >
                        {task.done ? '✓' : ''}
                      </button>
                      <div className="task-details">
                        <span className="task-title">{task.title}</span>
                        <span className="muted-text">
                          {task.time} · {task.category}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="panel progress-panel">
              <div className="panel-heading compact">
                <h2>Күннің нәтижесі</h2>
              </div>

              <div className="ring-wrap">
                <div
                  className="progress-ring"
                  style={{
                    '--progress': `${progress * 3.6}deg`,
                  } as React.CSSProperties}
                >
                  <div className="ring-inner">
                    <strong>{progress}%</strong>
                    <span>орындалды</span>
                  </div>
                </div>
              </div>

              <p className="progress-message">
                Әр орындалған тапсырма сені мақсатыңа жақындатады.
              </p>
            </div>
          </section>
        )}

        {page === 'plans' && (
          <section className="panel tasks-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">ЖЕКЕ ЖОСПАРЛАУ</span>
                <h2>Тапсырмалар</h2>
              </div>
            </div>

            <form className="add-task-form expanded-form" onSubmit={addTask}>
              <label className="field-label">
                Тапсырманың атауы
                <input
                  required
                  placeholder="Мысалы: React үйрену"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label className="field-label">
                Санаты
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  <option>Оқу</option>
                  <option>Жеке</option>
                  <option>Даму</option>
                  <option>Өмір</option>
                  <option>Жұмыс</option>
                </select>
              </label>

              <label className="field-label">
                Күні
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </label>

              <label className="field-label">
                Уақыты
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>

              <button type="submit" className="add-button">
                ＋ Жоспарды сақтау
              </button>
            </form>

            <label className="field-label date-filter">
              Қай күннің жоспарларын қараймыз?
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </label>

            <div className="task-list">
              {[...filteredTasks]
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((task) => (
                  <article className="task-row" key={task.id}>
                    <button
                      className={`task-check ${task.done ? 'checked' : ''}`}
                      onClick={() => toggleTask(task.id)}
                      aria-label="Тапсырма күйін өзгерту"
                    >
                      {task.done ? '✓' : ''}
                    </button>

                    <div className="task-details">
                      <span className="task-title">{task.title}</span>
                      <span className="muted-text">
                        {task.time} · {task.category}
                      </span>
                    </div>

                    <button
                      className="delete-task"
                      aria-label="Тапсырманы өшіру"
                      onClick={() => deleteTask(task.id)}
                    >
                      ×
                    </button>
                  </article>
                ))}

              {filteredTasks.length === 0 && (
                <div className="empty-state">
                  <span>✧</span>
                  <p>Бұл күнге тапсырма табылмады.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {page === 'calendar' && (
          <section className="panel calendar-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">УАҚЫТТЫ ЖОСПАРЛА</span>
                <h2>Күнтізбе</h2>
              </div>

              <div className="calendar-controls">
                <button onClick={() => changeMonth(-1)} aria-label="Алдыңғы ай">
                  ‹
                </button>
                <button onClick={() => changeMonth(1)} aria-label="Келесі ай">
                  ›
                </button>
              </div>
            </div>

            <h3 className="calendar-month">{monthName}</h3>

            <div className="calendar-grid">
              {['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'].map((day) => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              ))}

              {calendarDays.map((day, index) => {
                const dayString = day
                  ? `${calendarMonth.getFullYear()}-${String(
                      calendarMonth.getMonth() + 1,
                    ).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  : ''

                const hasTasks = tasks.some((task) => task.date === dayString)

                return (
                  <button
                    key={`${day}-${index}`}
                    className={`calendar-day ${
                      dayString === selectedDate ? 'selected' : ''
                    } ${dayString === today() ? 'is-today' : ''}`}
                    disabled={!day}
                    onClick={() => {
                      setSelectedDate(dayString)
                      setDate(dayString)
                    }}
                  >
                    {day || ''}
                    {hasTasks && <span className="calendar-dot" />}
                  </button>
                )
              })}
            </div>

            <div className="calendar-agenda">
              <h3>
                {new Intl.DateTimeFormat('kk-KZ', {
                  day: 'numeric',
                  month: 'long',
                }).format(new Date(`${selectedDate}T12:00:00`))}
                {' — жоспарлар'}
              </h3>

              {tasks.filter((task) => task.date === selectedDate).length ===
              0 ? (
                <p className="muted-text">Бұл күнге жоспар әзірге жоқ.</p>
              ) : (
                tasks
                  .filter((task) => task.date === selectedDate)
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((task) => (
                    <div className="task-row" key={task.id}>
                      <button
                        className={`task-check ${task.done ? 'checked' : ''}`}
                        onClick={() => toggleTask(task.id)}
                        aria-label="Тапсырма күйін өзгерту"
                      >
                        {task.done ? '✓' : ''}
                      </button>
                      <div className="task-details">
                        <span className="task-title">{task.title}</span>
                        <span className="muted-text">
                          {task.time} · {task.category}
                        </span>
                      </div>
                    </div>
                  ))
              )}

              <button
                className="add-button calendar-add"
                onClick={() => {
                  setDate(selectedDate)
                  setPage('plans')
                }}
              >
                ＋ Осы күнге жоспар қосу
              </button>
            </div>
          </section>
        )}

        {page === 'goals' && (
          <section className="panel tasks-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">ҮЛКЕН АРМАНДАР</span>
                <h2>Мақсаттарым</h2>
              </div>
            </div>

            <form className="add-task-form expanded-form" onSubmit={addGoal}>
              <label className="field-label">
                Мақсатың
                <input
                  required
                  placeholder="Мысалы: TypeScript үйрену"
                  value={goalTitle}
                  onChange={(event) => setGoalTitle(event.target.value)}
                />
              </label>

              <label className="field-label">
                Мақсаттың қадам саны
                <input
                  type="number"
                  min="1"
                  max="10000"
                  required
                  value={goalTarget}
                  onChange={(event) =>
                    setGoalTarget(Number(event.target.value))
                  }
                />
              </label>

              <button type="submit" className="add-button">
                ＋ Мақсат қосу
              </button>
            </form>

            <div className="goal-list">
              {goals.map((goal) => {
                const percent = Math.round(
                  (goal.current / goal.target) * 100,
                )

                return (
                  <article className="goal-card" key={goal.id}>
                    <div className="panel-heading">
                      <h3>{goal.title}</h3>

                      <button
                        type="button"
                        className="edit-goal"
                        aria-label="Мақсатты өзгерту"
                        onClick={() => editGoal(goal.id)}
                      >
                        Өзгерту
                      </button>

                      <button
                        className="delete-task"
                        aria-label="Мақсатты өшіру"
                        onClick={() => deleteGoal(goal.id)}
                      >
                        ×
                      </button>
                    </div>

                    <div className="goal-progress-labels">
                      <span>
                        {goal.current} / {goal.target} қадам
                      </span>
                      <strong>{percent}%</strong>
                    </div>

                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="goal-actions">
                      <button
                        className="button-secondary"
                        disabled={goal.current === 0}
                        onClick={() => changeGoal(goal.id, -1)}
                      >
                        − Азайту
                      </button>

                      <button
                        className="add-button"
                        disabled={goal.current >= goal.target}
                        onClick={() => changeGoal(goal.id, 1)}
                      >
                        ＋ Қадам қосу
                      </button>
                    </div>

                    {percent === 100 && (
                      <p className="goal-success">
                        🎉 Құттықтаймыз! Мақсатыңа жеттің!
                      </p>
                    )}
                  </article>
                )
              })}

              {goals.length === 0 && (
                <div className="empty-state">
                  <span>◎</span>
                  <p>Мақсатыңды жазып, оған қарай алғашқы қадамыңды жаса.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {page === 'stats' && (
          <section className="panel tasks-panel">
            <div className="panel-heading">
              <div>
                <span className="section-kicker">СЕНІҢ ЖЕТІСТІКТЕРІҢ</span>
                <h2>Статистика</h2>
              </div>
            </div>

            <div className="stats-grid inner-stats">
              <article className="stat-card">
                <div className="stat-heading">Барлық тапсырма</div>
                <strong>{tasks.length}</strong>
              </article>

              <article className="stat-card">
                <div className="stat-heading">Орындалған</div>
                <strong>{completed}</strong>
              </article>

              <article className="stat-card">
                <div className="stat-heading">Мақсаттар</div>
                <strong>{goals.length}</strong>
              </article>
            </div>

            <h3 className="calendar-month">Жалпы прогресс — {progress}%</h3>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>
        )}

        <footer className="main-footer">
          <span>✦ QADAM</span>
          <span>Өз уақытың. Өз мақсатың. Өз жолың.</span>
        </footer>
      </main>
    </div>
  )
}

export default App
