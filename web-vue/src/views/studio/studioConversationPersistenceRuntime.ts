import { ref, type Ref, watch } from 'vue'
import { getStringPreference, preferenceKeys, setStringPreference } from '@/lib/preferences'
import type { StudioConversation, StudioConversationBadgeState } from '@/components/studio/types'
import {
  loadStudioConversationNotices,
  loadStudioConversations,
  persistStudioConversationNotices,
  persistStudioConversations,
} from './studioConversationState'

type StudioConversationIdSetRef = {
  value: Set<string>
}

export type StudioConversationPersistenceRuntimeInput = {
  conversations: Ref<StudioConversation[]>
  conversationNotices: Ref<Record<string, StudioConversationBadgeState>>
  activeConversationId: Ref<string>
  validConversationIds: StudioConversationIdSetRef
  onSaveError: (message: string) => void
}

export type StudioConversationPersistenceRuntime = ReturnType<typeof useStudioConversationPersistenceRuntime>

export function useStudioConversationPersistenceRuntime(input: StudioConversationPersistenceRuntimeInput) {
  const isReady = ref(false)
  const loadError = ref('')
  const saveError = ref('')
  const isSaving = ref(false)
  let conversationsTimer: number | null = null
  let conversationNoticesTimer: number | null = null
  let activeConversationTimer: number | null = null
  let revision = 0
  let savedRevision = 0
  let writingRevision = 0
  let pendingWrites = 0
  let noticesDirty = false
  let activeIdDirty = false
  let disposed = false
  let restoring: Promise<void> | null = null

  const stopConversationWatch = watch(input.conversations, scheduleConversations, { flush: 'sync' })
  const stopConversationNoticeWatch = watch(input.conversationNotices, scheduleConversationNotices, { flush: 'sync' })
  const stopActiveConversationWatch = watch(input.activeConversationId, scheduleActiveConversationId, { flush: 'sync' })

  function restore() {
    if (restoring) return restoring
    loadError.value = ''
    restoring = (async () => {
      try {
        const conversations = await loadStudioConversations()
        if (disposed) return
        input.conversations.value = conversations
        try {
          input.conversationNotices.value = loadStudioConversationNotices()
          input.activeConversationId.value = getStringPreference(preferenceKeys.studioActiveConversationId, '')
        } catch {
          input.onSaveError('会话已恢复，但列表偏好读取失败')
        }
        isReady.value = true
      } catch {
        if (!disposed) loadError.value = '会话历史读取失败，请重试。已保存的记录未被覆盖。'
      } finally {
        restoring = null
      }
    })()
    return restoring
  }

  function scheduleConversations() {
    if (!isReady.value || disposed) return
    revision += 1
    if (conversationsTimer !== null) return
    conversationsTimer = window.setTimeout(() => {
      conversationsTimer = null
      saveConversations()
    }, 150)
  }

  function scheduleConversationNotices() {
    if (!isReady.value || disposed) return
    noticesDirty = true
    if (conversationNoticesTimer !== null) return
    conversationNoticesTimer = window.setTimeout(() => {
      conversationNoticesTimer = null
      saveConversationNotices()
    }, 150)
  }

  function scheduleActiveConversationId() {
    if (!isReady.value || disposed) return
    activeIdDirty = true
    if (activeConversationTimer !== null) {
      window.clearTimeout(activeConversationTimer)
    }
    activeConversationTimer = window.setTimeout(() => {
      activeConversationTimer = null
      saveActiveConversationId()
    }, 150)
  }

  function saveConversations() {
    if (savedRevision >= revision || (pendingWrites > 0 && writingRevision >= revision)) return
    const targetRevision = revision
    writingRevision = targetRevision
    pendingWrites += 1
    isSaving.value = true
    void persistStudioConversations(input.conversations.value).then(() => {
      savedRevision = Math.max(savedRevision, targetRevision)
      if (savedRevision === revision) saveError.value = ''
    }).catch((error: unknown) => {
      if (savedRevision >= targetRevision) return
      const message = error instanceof DOMException && error.name === 'QuotaExceededError'
        ? '会话未能保存，请勿关闭页面。请释放浏览器存储空间后重试。'
        : '会话未能保存，请勿关闭页面。请重试保存。'
      if (!saveError.value && !disposed) input.onSaveError(message)
      saveError.value = message
    }).finally(() => {
      pendingWrites -= 1
      isSaving.value = pendingWrites > 0
    })
  }

  function saveConversationNotices() {
    try {
      persistStudioConversationNotices(input.conversationNotices.value, input.validConversationIds.value)
      noticesDirty = false
    } catch {
      if (!disposed) input.onSaveError('会话列表状态保存失败')
    }
  }

  function saveActiveConversationId() {
    try {
      setStringPreference(preferenceKeys.studioActiveConversationId, input.activeConversationId.value)
      activeIdDirty = false
    } catch {
      if (!disposed) input.onSaveError('当前会话选择保存失败')
    }
  }

  function flush() {
    if (!isReady.value) return
    if (conversationsTimer !== null) window.clearTimeout(conversationsTimer)
    if (conversationNoticesTimer !== null) window.clearTimeout(conversationNoticesTimer)
    if (activeConversationTimer !== null) window.clearTimeout(activeConversationTimer)
    conversationsTimer = null
    conversationNoticesTimer = null
    activeConversationTimer = null
    saveConversations()
    if (noticesDirty) saveConversationNotices()
    if (activeIdDirty) saveActiveConversationId()
  }

  function beforeUnload(event: BeforeUnloadEvent) {
    flush()
    if (savedRevision < revision) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  function onVisibilityChange() {
    if (document.hidden) flush()
  }

  function dispose() {
    stopConversationWatch()
    stopConversationNoticeWatch()
    stopActiveConversationWatch()
    flush()
    disposed = true
    window.removeEventListener('pagehide', flush)
    window.removeEventListener('beforeunload', beforeUnload)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }

  window.addEventListener('pagehide', flush)
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', onVisibilityChange)
  void restore()

  return {
    isReady,
    loadError,
    saveError,
    isSaving,
    restore,
    flush,
    scheduleConversationNotices,
    scheduleConversations,
    dispose,
  }
}
