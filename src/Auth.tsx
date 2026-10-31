import { useState, type FormEvent } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        setMessage('Сәтті кірдің!')
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error
        setMessage('Тіркелу сұранысы жіберілді! Электрондық поштаңды тексер.')
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Қате пайда болды.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">✦ QADAM</div>

        <h1>{isLogin ? 'Қайта оралдың!' : 'QADAM-ға қосыл'}</h1>

        <p>
          {isLogin
            ? 'Жоспарларыңа қол жеткізу үшін кір.'
            : 'Өз мақсатыңа қарай алғашқы қадамыңды жаса.'}
        </p>

        <label>
          Электрондық пошта
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Құпиясөз
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Кемінде 6 таңба"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading
            ? 'Күте тұр...'
            : isLogin
              ? 'Жүйеге кіру'
              : 'Тіркелу'}
        </button>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setIsLogin(!isLogin)
            setMessage('')
          }}
        >
          {isLogin
            ? 'Аккаунтың жоқ па? Тіркелу'
            : 'Аккаунтың бар ма? Кіру'}
        </button>

        {message && <p className="auth-message">{message}</p>}
      </form>
    </div>
  )
}
