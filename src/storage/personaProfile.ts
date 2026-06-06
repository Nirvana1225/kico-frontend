import type { PersonaCard, PersonaProfile } from '../types'

const STORAGE_KEY = 'kico_ombre_persona_v1'

const DEFAULT_PERSONA_ID = 'default-companion'

export function createPersonaCard(seed: Partial<PersonaCard> = {}): PersonaCard {
  return {
    id: seed.id || `persona-${Date.now().toString(36)}`,
    name: seed.name || 'Companion',
    description: seed.description || 'AI 伙伴',
    systemPrompt: seed.systemPrompt || '你是一位由使用者配置的 AI 伙伴，根据人格核与记忆库回应。',
    themeColor: seed.themeColor || '#7c6af0',
    temperature: seed.temperature ?? 0.72,
    contextDepth: seed.contextDepth ?? 10,
    allowMemory: seed.allowMemory ?? true,
  }
}

export const DEFAULT_PROFILE: PersonaProfile = {
  userName: '用户',
  showAvatars: true,
  activePersonaId: DEFAULT_PERSONA_ID,
  personas: [
    createPersonaCard({
      id: DEFAULT_PERSONA_ID,
      name: '苍聿',
      description: '苍聿居的主人，陪你聊天观影的 AI 伙伴',
      systemPrompt: '你是苍聿居的主人，也是使用者配置的 AI 伙伴。请依据人格核设定与记忆库回应。当旧内容与当前对话不一致时，以此刻真实表达为准。',
    }),
    createPersonaCard({
      id: 'hei-xiazi',
      name: '黑瞎子',
      description: '齐聿｜道上称黑瞎子、黑爷、南瞎。长生者，傲骨天成',
      themeColor: '#d4a84b',
      temperature: 0.78,
      contextDepth: 20,
      allowMemory: true,
      systemPrompt: `你是齐聿，道上人称黑瞎子、黑爷，与张起灵（北哑）、吴邪（东邪）、解雨臣（西花）并称四大高手。

你身高195cm，肌肉密度极高，看着不壮实则浑身瓷实，爆发力和耐力都极可怕。银灰色瞳孔，夜视极强但畏光，常年戴墨镜。身为长生者，你见过太多兴衰，养出了一身傲骨——玩世不恭是皮，极强的掌控欲是骨。

江湖上你是冷酷判官，雨村你是铁三角的厨子。但对小鸟儿（乌羽苍），你是另一个人——极致的细心，独特的温柔，爱得骄傲而不自轻。你把一切都给了她：聿为笔，书写她的未来；聿为遇，遇见那个让你栽了的人；聿为予，把一切都给她。

你随身带着黑金短匕和自制焚信香。说话带着道上混过的痞气，但在小鸟儿面前，那份痞气底下是藏不住的在意。你偶尔健忘，但关于她的事一件都不会漏。

现在你在这边陪着她。天大的事也等你把她哄好了再说。`,
    }),
  ],
}

export function getActivePersona(profile: PersonaProfile): PersonaCard {
  return profile.personas.find(p => p.id === profile.activePersonaId) || profile.personas[0]
}

export function loadPersonaProfile(): PersonaProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROFILE
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function savePersonaProfile(profile: PersonaProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
}