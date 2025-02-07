import { create } from "zustand"
import type { TopicItem, ActionResponse, HierarchyAnalysis } from "@/types/topic"
import type { MedicalTopic } from "@/lib/constants"
import { 
  fetchTopicTree, 
  updateTopicTree, 
  addTopicItem,
  changeItemSubject,
  deleteTopicItem,
  createTopicRelationship,
  deleteTopicRelationship,
  moveItemUpLevel,
  fetchTopicAnalysis,
} from "@/lib/topics"


interface TopicState {
  items: TopicItem[]
  selectedTopic: MedicalTopic | ""
  isLoading: boolean
  isSaving: boolean
  error: string | null
  isEditing: string | null
  tempEditValue: string | null
  lastScrollPosition: number
  analysisData: HierarchyAnalysis | null
  isAnalysisLoading: boolean
  isAnalysisPanelOpen: boolean
  setSelectedTopic: (topic: MedicalTopic | "") => void
  setItems: (items: TopicItem[]) => void
  fetchTopic: () => Promise<void>
  addItem: (afterId: string, isChild: boolean, name: string) => Promise<void>
  updateItemName: (id: string, name: string) => Promise<void>
  deleteItem: (id: string) => Promise<ActionResponse>
  moveItem: (dragId: string, dropId: string, isNested: boolean) => Promise<void>
  changeTopicSubject: (itemId: string, newTopic: MedicalTopic) => Promise<ActionResponse>
  setEditing: (id: string | null) => void
  setTempEditValue: (value: string | null) => void
  createRelationship: (sourceId: string, targetId: string, type: string) => Promise<ActionResponse>
  deleteRelationship: (sourceId: string) => Promise<ActionResponse>
  checkNestedLimit: (parentId: string | null, level: number) => boolean
  hasRelationship: (itemId: string) => boolean
  getRelatedItemId: (itemId: string) => string | null
  moveItemUp: (itemId: string) => Promise<ActionResponse>
  setLastScrollPosition: (position: number) => void
  updateItemNotes: (id: string, notes: string) => Promise<void>
  fetchAnalysis: () => Promise<void>
  toggleAnalysisPanel: () => void
  isItemInTree: (itemName: string) => boolean
}

export const useTopicStore = create<TopicState>((set, get) => ({
  items: [],
  selectedTopic: "",
  isLoading: false,
  isSaving: false,
  error: null,
  isEditing: null,
  tempEditValue: null,
  lastScrollPosition: 0,
  analysisData: null,
  isAnalysisLoading: false,
  isAnalysisPanelOpen: false,

  setSelectedTopic: (topic) => set({ selectedTopic: topic }),
  setItems: (items) => set({ items }),

  setLastScrollPosition: (position) => set({ lastScrollPosition: position }),

  fetchTopic: async () => {
    const { selectedTopic, lastScrollPosition } = get()
    if (!selectedTopic) return

    set({ isLoading: true })
    try {
      const data = await fetchTopicTree(selectedTopic)
      const transformedItems: TopicItem[] = data.items.map((item: any) => ({
        id: item.item_id,
        item_name: item.item_name,
        item_level: item.item_level,
        item_type: item.item_type,
        parent_element_id: item.parent_item_id,
        order_index: item.order_index,
        link: item.link,
        pdfLink: item.pdfLink,
        relationships: item.relationships?.map((rel: any) => ({
          targetId: rel.target_id.toString(),
          type: rel.relationship_type
        })) || []
      }))
      set({ items: transformedItems })
      
      // Restore scroll position after a brief delay to ensure DOM has updated
      setTimeout(() => {
        window.scrollTo({
          top: lastScrollPosition,
          behavior: 'instant'
        })
      }, 0)
    } catch (error) {
      console.error("Error fetching topics:", error)
      set({ error: error instanceof Error ? error.message : "Failed to fetch topics" })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (afterId, isChild, name) => {
    const { items, selectedTopic, checkNestedLimit } = get()
    if (!selectedTopic) return

    const referenceItem = items.find((item) => item.id === afterId)
    const newLevel = afterId === "0" ? 1 : 
      isChild ? referenceItem!.item_level + 1 : referenceItem!.item_level
    const newParentId = afterId === "0" ? null : 
      isChild ? afterId : referenceItem!.parent_element_id

    // Check limit before proceeding
    if (newLevel > 1 && !checkNestedLimit(newParentId, newLevel)) {
      set({ error: `Cannot add more items at level ${newLevel}. Maximum of 10 items reached.` })
      throw new Error(`Maximum items limit reached for level ${newLevel}`)
    }

    const sameLevel = items.filter(item => 
      afterId === "0" ? item.parent_element_id === null :
      isChild ? item.parent_element_id === afterId :
      item.parent_element_id === referenceItem?.parent_element_id
    )
    
    const newOrderIndex = sameLevel.length > 0
      ? Math.max(...sameLevel.map(i => i.order_index ?? 0)) + 1000
      : 1000

    const newItem = {
      item_name: name,
      item_type: null,
      item_level: newLevel,
      parent_element_id: newParentId,
      order_index: newOrderIndex,
      notes: null,  // Initialize with null instead of undefined
      link: null,
      pdfLink: null
    }

    set({ isSaving: true })
    try {
      const response = await addTopicItem(selectedTopic, newItem)
      
      if (response.success) {
        // Update the newItem with the server-generated ID
        const clientItem: TopicItem = {
          id: response.item.id,
          item_name: newItem.item_name,
          item_type: newItem.item_type,
          item_level: newItem.item_level,
          parent_element_id: newItem.parent_element_id,
          order_index: newOrderIndex,
          notes: newItem.notes,
          link: newItem.link,
          pdfLink: newItem.pdfLink
        }

        if (afterId === "0") {
          set({ items: [...items, clientItem] })
          return
        }

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
          insertionIndex = getLastDescendantIndex(referenceIndex, referenceItem!.item_level)
        }

        const newItems = [
          ...items.slice(0, insertionIndex + 1), 
          clientItem,
          ...items.slice(insertionIndex + 1)
        ]
        set({ items: newItems })
      }
    } catch (error) {
      console.error("Error adding item:", error)
      set({ error: error instanceof Error ? error.message : "Failed to add item" })
      throw error
    } finally {
      set({ isSaving: false })
    }
  },

  updateItemName: async (id, name) => {
    const { items, selectedTopic } = get()
    const newItems = items.map((item) => 
      item.id === id ? { 
        ...item, 
        item_name: name,
        // Preserve existing item_type
        item_type: item.item_type 
      } : item
    )
    
    set({ isSaving: true })
    try {
      await updateTopicTree(selectedTopic, newItems)
      set({ items: newItems })
    } catch (error) {
      console.error("Error updating item name:", error)
      set({ error: error instanceof Error ? error.message : "Failed to update item name" })
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
      } else {
        set({ error: response.error || "Failed to delete item" })
      }
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  },

  moveItem: async (dragId, dropId, isNested) => {
    const { items, selectedTopic, checkNestedLimit } = get()
    const dragItem = items.find((item) => item.id === dragId)
    const dropItem = items.find((item) => item.id === dropId)
    if (!dragItem || !dropItem) return

    const newLevel = isNested ? dropItem.item_level + 1 : dropItem.item_level
    const newParentId = isNested ? dropId : dropItem.parent_element_id
    const levelDifference = newLevel - dragItem.item_level

        // Check limit before proceeding
        if (newLevel > 1) {
          // Count existing items at target level/parent, excluding the item being moved
          const targetSiblings = items.filter(item => 
            item.item_level === newLevel && 
            item.parent_element_id === newParentId &&
            item.id !== dragId
          )
    
          if (targetSiblings.length >= 10) {
            set({ error: `Cannot move item. Maximum of 10 items reached at target level.` })
            throw new Error(`Maximum items limit reached at target level`)
          }
        }

    // Get all descendants and their relative levels
    const descendants = new Map<string, number>()
    const getAllDescendants = (parentId: string, baseLevel: number) => {
      items.forEach((item) => {
        if (item.parent_element_id === parentId) {
          // Store the level difference relative to their immediate parent
          descendants.set(item.id, item.item_level - baseLevel)
          getAllDescendants(item.id, item.item_level)
        }
      })
    }
    getAllDescendants(dragId, dragItem.item_level)

    // Calculate new order index for the dragged item
    const sameLevel = items.filter(item => 
      isNested ? item.parent_element_id === dropId :
      item.parent_element_id === dropItem.parent_element_id
    )
    
    const newOrderIndex = sameLevel.length > 0
      ? Math.max(...sameLevel.map(i => i.order_index ?? 0)) + 1000
      : 1000

    // Update items with correct parent IDs and levels
    const updatedItems = items.map((item) => {
      if (item.id === dragId) {
        // Only change parent_id for the dragged item
        return { 
          ...item, 
          item_level: newLevel,
          parent_element_id: newParentId,
          order_index: newOrderIndex
        }
      }
      if (descendants.has(item.id)) {
        // For descendants, only adjust their levels while keeping their parent relationships
        return {
          ...item,
          item_level: item.item_level + levelDifference
        }
      }
      return item
    })

    set({ isSaving: true })
    try {
      await updateTopicTree(selectedTopic, updatedItems)
      set({ items: updatedItems })
    } catch (error) {
      console.error("Error moving item:", error)
      set({ error: error instanceof Error ? error.message : "Failed to move item" })
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

    const updatedItems = items.map((item) => 
      item.id === itemId ? {
        ...item,
        // Preserve existing item_type
        item_type: item.item_type,
        // Update other fields as needed
      } : item
    )

    set({ isSaving: true })
    try {
      const response = await changeItemSubject(selectedTopic, newTopic, itemId)
      
      if (response.success) {
        const idsToRemove = new Set<string>([itemId])
        let foundNew = true

        while (foundNew) {
          foundNew = false
          updatedItems.forEach((item) => {
            if (item.parent_element_id !== null && 
                idsToRemove.has(item.parent_element_id) && 
                !idsToRemove.has(item.id)) {
              idsToRemove.add(item.id)
              foundNew = true
            }
          })
        }

        const newItems = updatedItems.filter(item => !idsToRemove.has(item.id))
        set({ items: newItems, error: null })
      } else {
        set({ error: response.error || "Failed to change topic" })
      }
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  },

  setEditing: (id) => set({ isEditing: id }),
  setTempEditValue: (value) => set({ tempEditValue: value }),

  createRelationship: async (sourceId, targetId, type) => {
    const { selectedTopic, hasRelationship, fetchTopic } = get()
    
    if (hasRelationship(sourceId) || hasRelationship(targetId)) {
      set({ error: "One or both items already have a relationship" })
      return { 
        success: false, 
        message: "One or both items already have a relationship" 
      }
    }
    
    set({ isSaving: true })
    try {
      const response = await createTopicRelationship(selectedTopic, sourceId, targetId)
      
      if (response.success) {
        // Fetch fresh data to get the correct ordering
        await fetchTopic()
      }
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  },

  deleteRelationship: async (sourceId: string) => {
    const { selectedTopic, fetchTopic } = get()
    
    set({ isSaving: true })
    try {
      const response = await deleteTopicRelationship(selectedTopic, sourceId)
      
      if (response.success) {
        // Save scroll position before fetching
        set({ lastScrollPosition: window.scrollY })
        await fetchTopic()
      }
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  },

  // Add utility function to check nested item limits
  checkNestedLimit: (parentId: string | null, level: number): boolean => {
    const { items } = get()
    const siblings = items.filter(item => 
      item.item_level === level && 
      item.parent_element_id === parentId
    )
    return siblings.length < 10
  },

  validateMove: (dragId: string, newParentId: string | null, newLevel: number) => {
    const { items } = get()
    
    // Get all items being moved
    const itemsBeingMoved = new Set<string>([dragId])
    const getAllDescendants = (parentId: string) => {
      items.forEach(item => {
        if (item.parent_element_id === parentId) {
          itemsBeingMoved.add(item.id)
          getAllDescendants(item.id)
        }
      })
    }
    getAllDescendants(dragId)

    // Count existing items at target level
    const targetSiblings = items.filter(item => 
      item.item_level === newLevel && 
      item.parent_element_id === newParentId &&
      !itemsBeingMoved.has(item.id)
    )

    if (targetSiblings.length >= 10) {
      throw new Error(`Cannot move item. Maximum of 10 items reached at target level.`)
    }

    // Validate no circular references
    let currentParent = newParentId
    while (currentParent) {
      if (itemsBeingMoved.has(currentParent)) {
        throw new Error("Cannot create circular reference")
      }
      const parentItem = items.find(item => item.id === currentParent)
      currentParent = parentItem?.parent_element_id || null
    }

    return true
  },

  hasRelationship: (itemId: string): boolean => {
    const { items } = get()
    const item = items.find(i => i.id === itemId)
    return (item?.relationships?.length ?? 0) > 0 || 
           items.some(i => i.relationships?.some(r => r.targetId === itemId))
  },


  getRelatedItemId: (itemId: string): string | null => {
    const { items } = get()
    const item = items.find(i => i.id === itemId)
    
    // Check if item has outgoing relationship
    if (item?.relationships?.length) {
      return item.relationships[0].targetId
    }
    
    // Check if item has incoming relationship
    const incomingRel = items.find(i => 
      i.relationships?.some(r => r.targetId === itemId)
    )
    return incomingRel?.id || null
  },

  moveItemUp: async (itemId: string): Promise<ActionResponse> => {
    const { selectedTopic, fetchTopic } = get()
    
    if (!selectedTopic) {
      return {
        success: false,
        message: "No topic selected"
      }
    }

    set({ isSaving: true })
    try {
      const response = await moveItemUpLevel(selectedTopic, itemId)
      
      if (response.success) {
        // Save scroll position before fetching
        set({ lastScrollPosition: window.scrollY })
        await fetchTopic()
      }
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred"
      set({ error: message })
      return { success: false, message }
    } finally {
      set({ isSaving: false })
    }
  },

  updateItemNotes: async (id, notes) => {
    const { items, selectedTopic } = get()
    const newItems = items.map((item) => 
      item.id === id ? { 
        ...item, 
        notes,
      } : item
    )
    
    set({ isSaving: true })
    try {
      await updateTopicTree(selectedTopic, newItems)
      set({ items: newItems })
    } catch (error) {
      console.error("Error updating item notes:", error)
      set({ error: error instanceof Error ? error.message : "Failed to update item notes" })
    } finally {
      set({ isSaving: false })
    }
  },

  fetchAnalysis: async () => {
    const { selectedTopic, isAnalysisPanelOpen } = get()
    
    if (isAnalysisPanelOpen) {
      set({ isAnalysisPanelOpen: false })
      return
    }
    
    if (!selectedTopic) return
    
    set({ isAnalysisLoading: true })
    try {
      const analysis = await fetchTopicAnalysis(selectedTopic)
      set({ 
        analysisData: analysis,
        isAnalysisPanelOpen: true 
      })
    } catch (error) {
      console.error("Error loading analysis:", error)
      throw error
    } finally {
      set({ isAnalysisLoading: false })
    }
  },

  toggleAnalysisPanel: () => {
    set(state => ({ isAnalysisPanelOpen: !state.isAnalysisPanelOpen }))
  },

  isItemInTree: (itemName: string) => {
    const { items } = get()
    return items.some(item => 
      item.item_name.toLowerCase() === itemName.toLowerCase()
    )
  },

})) 