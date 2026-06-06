import { useMemo, useState } from 'react'
import { Clapperboard, MessageCircle, BookOpen, Database, UserRound, SlidersHorizontal, Settings, Activity, List, Music } from 'lucide-react'
import { ChatPage } from './components/chat/ChatPage'
import { CinemaRoom } from './components/CinemaRoom'
import { CoReadPage } from './components/CoReadPage'
import { MemoryPage } from './components/MemoryPage'
import { PersonaCorePage } from './components/PersonaCorePage'
import { VectorLabPage } from './components/VectorLabPage'
import { SettingsPage } from './components/SettingsPage'
import { AutoPanel } from './components/AutoPanel'
import { MemoryOverviewPage } from './components/MemoryOverviewPage'
import { MoodPage } from './components/MoodPage'
import { getActivePersona, loadPersonaProfile, savePersonaProfile } from './storage/personaProfile'
import type { PersonaProfile } from './types'
import { loadUplinkSettings, saveUplinkSettings } from './settings/uplinkSettings'
import type { UplinkSettings, AppPage } from './types'
import { createOmbreMemoryAdapter, createOmbreLLMAdapter, createPersonaAdapter } from './adapters/companionAdapters'

const ROUTE_ITEMS: Array<{ page: AppPage; label: string; icon: typeof Clapperboard }> = [
  { page: 'cinema', label: '观影室', icon: Clapperboard },
  { page: 'coread', label: '共读', icon: BookOpen },
  { page: 'chat', label: '长对话', icon: MessageCircle },
  { page: 'mood', label: '情绪', icon: Music },
  { page: 'auto', label: '自动化', icon: Activity },
  { page: 'persona', label: '人格核', icon: UserRound },
  { page: 'memory', label: '记忆库', icon: Database },
  { page: 'overview', label: '全览', icon: List },
  { page: 'vector', label: '调音台', icon: SlidersHorizontal },
  { page: 'settings', label: '设置', icon: Settings },
]

export function App() {
  const [personaProfile, setPersonaProfile] = useState<PersonaProfile>(() => loadPersonaProfile())
  const [uplinkSettings, setUplinkSettings] = useState<UplinkSettings>(() => loadUplinkSettings())
  const [activePage, setActivePage] = useState<AppPage>('cinema')
  const [cinemaConvId, setCinemaConvId] = useState<string>('')

  const activePersona = useMemo(() => getActivePersona(personaProfile), [personaProfile])

  const updateSettings = (next: UplinkSettings) => {
    setUplinkSettings(next)
    saveUplinkSettings(next)
  }

  const updateProfile = (next: PersonaProfile) => {
    setPersonaProfile(next)
    savePersonaProfile(next)
  }

  const adapters = useMemo(() => ({
    persona: createPersonaAdapter(
      () => ({
        name: activePersona.name,
        systemPrompt: activePersona.systemPrompt,
        description: activePersona.description,
      }),
      () => personaProfile.userName,
    ),
    memory: createOmbreMemoryAdapter(() => activePersona.allowMemory),
    llm: createOmbreLLMAdapter(() => uplinkSettings),
  }), [activePersona, personaProfile.userName, uplinkSettings])

  return (
    <div className={`app-layout theme-${uplinkSettings.visual.theme}`}>
      <nav className="route-switcher">
        {ROUTE_ITEMS.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.page}
              className={`route-btn ${activePage === item.page ? 'active' : ''}`}
              onClick={() => setActivePage(item.page)}
              title={item.label}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <main className="page-container">
        {activePage === 'cinema' && (
          <CinemaRoom
            adapters={adapters}
            personaProfile={personaProfile}
            onOpenChat={() => setActivePage('chat')}
            onOpenChatWithConv={(convId) => { setCinemaConvId(convId); setActivePage('chat'); }}
            onOpenPersona={() => setActivePage('persona')}
            onOpenMemory={() => setActivePage('memory')}
          />
        )}
        {activePage === 'coread' && (
          <CoReadPage adapters={adapters} personaProfile={personaProfile} />
        )}
        {activePage === 'chat' && (
          <ChatPage
            adapters={adapters}
            personaProfile={personaProfile}
            initialConversationId={cinemaConvId || undefined}
            onClose={() => { setCinemaConvId(''); setActivePage('cinema'); }}
          />
        )}
        {activePage === 'auto' && (
          <AutoPanel onClose={() => setActivePage('cinema')} />
        )}
        {activePage === 'mood' && (
          <MoodPage onClose={() => setActivePage('cinema')} />
        )}
        {activePage === 'persona' && (
          <PersonaCorePage
            profile={personaProfile}
            onChange={updateProfile}
            onClose={() => setActivePage('cinema')}
          />
        )}
        {activePage === 'memory' && (
          <MemoryPage onClose={() => setActivePage('cinema')} />
        )}
        {activePage === 'overview' && (
          <MemoryOverviewPage onClose={() => setActivePage('cinema')} />
        )}
        {activePage === 'vector' && (
          <VectorLabPage settings={uplinkSettings} onChange={updateSettings} />
        )}
        {activePage === 'settings' && (
          <SettingsPage
            settings={uplinkSettings}
            onChange={updateSettings}
            personaProfile={personaProfile}
            onPersonaChange={updateProfile}
            onClose={() => setActivePage('cinema')}
          />
        )}
      </main>
    </div>
  )
}