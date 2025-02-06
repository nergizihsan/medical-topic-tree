import { create } from "zustand"
import type { TopicItem } from "@/types/topic"
import type { MedicalTopic } from "@/lib/constants"
import { 
  fetchTopicTree, 
  updateTopicTree, 
  addTopicItem,
  changeItemSubject,
  deleteTopicItem 
} from "@/app/actions/topics"

// Helper function to generate temporary IDs
const generateTempId = () => Math.random().toString(36).substring(2, 15)

interface TopicState {
  items: TopicItem[]
  selectedTopic: MedicalTopic | ""
  isLoading: boolean
  isSaving: boolean
  error: string | null
  setSelectedTopic: (topic: MedicalTopic | "") => void
  setItems: (items: TopicItem[]) => void
  fetchTopic: () => Promise<void>
  addItem: (afterId: string, isChild: boolean) => Promise<void>
  updateItemName: (id: string, name: string) => Promise<void>
  deleteItem: (id: string) => Promise<{ success: boolean; message: string }>
  moveItem: (dragId: string, dropId: string, isNested: boolean) => Promise<void>
  changeTopicSubject: (itemId: string, newTopic: MedicalTopic) => Promise<{ success: boolean; message: string }>
}

export const useTopicStore = create<TopicState>((set, get) => ({
  items: [],
  selectedTopic: "",
  isLoading: false,
  isSaving: false,
  error: null,

  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setItems: (items) => set({ items }),

  fetchTopic: async () => {
    const { selectedTopic } = get()
    if (!selectedTopic) return

    set({ isLoading: true })
    try {
      const data = await fetchTopicTree(selectedTopic)
      const transformedItems = data.items.map((item: any) => ({
        id: item.item_id,
        item_name: item.item_name,
        item_level: item.item_level,
        parent_element_id: item.parent_item_id,
      }))
      set({ items: transformedItems })
    } catch (error) {
      console.error("Error fetching topics:", error)
      // TODO: Add error handling
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (afterId, isChild) => {
    const { items, selectedTopic } = get()
    const referenceItem = items.find((item) => item.id === afterId)
    if (!referenceItem || !selectedTopic) return

    // Generate a temporary string ID instead of ObjectId
    const newId = generateTempId()
    const newItem: TopicItem = {
      id: newId,
      item_name: "",
      item_level: isChild ? referenceItem.item_level + 1 : referenceItem.item_level,
      parent_element_id: isChild ? referenceItem.id : referenceItem.parent_element_id,
    }

    // Find insertion index logic
    const referenceIndex = items.findIndex((item) => item.id === afterId)
    if (referenceIndex === -1) return

    let insertionIndex = referenceIndex
    if (!isChild) {
      const getLastDescendantIndex = (startIndex: number, level: number) => {
        let lastIndex = startIndex
        for (let i = startIndex + 1; i < items.length; i++) {
          if (items[i].item_level <= level) break
          lastIndex = i
        }
        return lastIndex
      }
      insertionIndex = getLastDescendantIndex(referenceIndex, referenceItem.item_level)
    }

    const newItems = [...items.slice(0, insertionIndex + 1), newItem, ...items.slice(insertionIndex + 1)]

    set({ isSaving: true })
    try {
      await addTopicItem(selectedTopic, newItem)
      set({ items: newItems })
    } catch (error) {
      console.error("Error adding item:", error)
      // TODO: Add error handling
    } finally {
      set({ isSaving: false })
    }
  },

  updateItemName: async (id, name) => {
    const { items, selectedTopic } = get()
    const newItems = items.map((item) => (item.id === id ? { ...item, item_name: name } : item))
    
    set({ isSaving: true })
    try {
      await updateTopicTree(selectedTopic, newItems)
      set({ items: newItems })
    } catch (error) {
      console.error("Error updating item name:", error)
      // TODO: Add error handling
    } finally {
      set({ isSaving: false })
    }
  },

  deleteItem: async (id) => {
    const { selectedTopic, items } = get()
    if (!selectedTopic) return { success: false, message: "No topic selected" }

    set({ isSaving: true })
    try {
      const response = await deleteTopicItem(selectedTopic, id)
      
      if (response.success) {
        const idsToDelete = new Set<string>([id])
        let foundNew = true

        while (foundNew) {
          foundNew = false
          items.forEach((item) => {
            if (item.parent_element_id !== null && 
                idsToDelete.has(item.parent_element_id) && 
                !idsToDelete.has(item.id)) {
              idsToDelete.add(item.id)
              foundNew = true
            }
          })
        }

        const newItems = items.filter(item => !idsToDelete.has(item.id))
        set({ items: newItems, error: null })
        return { success: true, message: response.message }
      } else {
        set({ error: response.error || "Failed to delete item" })
        return { success: false, message: response.message }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  },

  moveItem: async (dragId, dropId, isNested) => {
    const { items, selectedTopic } = get()
    const dragItem = items.find((item) => item.id === dragId)
    const dropItem = items.find((item) => item.id === dropId)
    if (!dragItem || !dropItem) return

    // Get all descendants logic
    const childrenIds = new Set<string>()
    const getAllChildren = (parentId: string) => {
      items.forEach((item) => {
        if (item.parent_element_id === parentId) {
          childrenIds.add(item.id)
          getAllChildren(item.id)
        }
      })
    }
    getAllChildren(dragId)

    const newLevel = isNested ? dropItem.item_level + 1 : dropItem.item_level
    const newParentId = isNested ? dropId : dropItem.parent_element_id
    const levelDiff = newLevel - dragItem.item_level

    const updatedItems = items.map((item) => {
      if (item.id === dragId) {
        return { ...item, item_level: newLevel, parent_element_id: newParentId }
      }
      if (childrenIds.has(item.id)) {
        return {
          ...item,
          item_level: item.item_level + levelDiff,
          parent_element_id: item.parent_element_id === dragItem.id ? newParentId : item.parent_element_id,
        }
      }
      return item
    })

    // Reorder items
    const reorderedItems: TopicItem[] = []
    const processedIds = new Set<string>()

    const addItemWithChildren = (parentId: string | null) => {
      updatedItems.forEach((item) => {
        if (item.parent_element_id === parentId && !processedIds.has(item.id)) {
          reorderedItems.push(item)
          processedIds.add(item.id)
          addItemWithChildren(item.id)
        }
      })
    }

    addItemWithChildren(null)

    set({ isSaving: true })
    try {
      await updateTopicTree(selectedTopic, reorderedItems)
      set({ items: reorderedItems })
    } catch (error) {
      console.error("Error moving item:", error)
      // TODO: Add error handling
    } finally {
      set({ isSaving: false })
    }
  },

  changeTopicSubject: async (itemId, newTopic) => {
    const { selectedTopic, items } = get()
    const item = items.find(i => i.id === itemId)
    
    if (!item || !selectedTopic || item.item_level !== 1) {
      return { success: false, message: "Invalid item or topic" }
    }

    set({ isSaving: true })
    try {
      const response = await changeItemSubject(selectedTopic, newTopic, itemId)
      
      if (response.success) {
        // Remove items from current topic
        const idsToRemove = new Set<string>([itemId])
        let foundNew = true

        while (foundNew) {
          foundNew = false
          items.forEach((item) => {
            if (item.parent_element_id !== null && 
                idsToRemove.has(item.parent_element_id) && 
                !idsToRemove.has(item.id)) {
              idsToRemove.add(item.id)
              foundNew = true
            }
          })
        }

        const newItems = items.filter(item => !idsToRemove.has(item.id))
        set({ items: newItems, error: null })
        return { success: true, message: response.message }
      } else {
        set({ error: response.error || "Failed to change topic" })
        return { success: false, message: response.message || "Failed to change topic" }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  }
})) 