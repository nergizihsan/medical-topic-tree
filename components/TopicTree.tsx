"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import TopicNode from "@/components/TopicNode"
import { useTopicStore } from "@/stores/useTopicStore"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEDICAL_TOPICS, MedicalTopic } from "@/lib/constants"
import type { TopicItem } from "@/types/topic"
import { toast } from "sonner"

interface TopicTreeProps {
  initialTopic: string
  initialItems: TopicItem[] | null
}

export default function TopicTree({ initialTopic, initialItems }: TopicTreeProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const { 
    items,
    selectedTopic,
    isLoading,
    isSaving,
    setSelectedTopic,
    setItems,
    fetchTopic,
    addItem,
    updateItemName,
    deleteItem,
    moveItem,
    changeTopicSubject
  } = useTopicStore()

  // Initialize with server-fetched data if available
  useEffect(() => {
    if (initialTopic && initialItems) {
      setSelectedTopic(initialTopic as MedicalTopic)
      setItems(initialItems)
    }
  }, [initialTopic, initialItems, setSelectedTopic, setItems])

  // Update URL when topic changes
  const handleTopicChange = (topic: string) => {
    const params = new URLSearchParams(searchParams)
    if (topic) {
      params.set("topic", topic)
    } else {
      params.delete("topic")
    }
    router.push(`?${params.toString()}`)
    setSelectedTopic(topic as MedicalTopic)
  }

  const handleBack = () => {
    router.push("/")
    setSelectedTopic("")
    setItems([])
  }

  const handleDelete = async (id: string) => {
    const result = await deleteItem(id)
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  // Helper function to create hierarchical structure
  const renderTopicNodes = (parentId: string | null = null) => {
    return items
      .filter(item => item.parent_element_id === parentId)
      .map(item => (
        <div key={item.id} style={{ marginLeft: `${item.item_level * 20}px` }}>
          <TopicNode
            item={item}
            onAddItem={addItem}
            onUpdateName={updateItemName}
            onDeleteItem={handleDelete}
            onMoveItem={moveItem}
          />
          {renderTopicNodes(item.id)}
        </div>
      ))
  }

  if (!selectedTopic || items.length === 0) {
    return (
      <div className="flex flex-col  items-center min-h-screen p-16">
        <h1 className="text-3xl font-bold text-medical-dark mb-8">Medical Topic Tree</h1>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-xl font-semibold mb-6 text-center">Select a Medical Topic</h2>
          <div className="space-y-4">
            <Select value={selectedTopic} onValueChange={handleTopicChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {MEDICAL_TOPICS.map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={fetchTopic} 
              disabled={!selectedTopic || isLoading}
              className="w-full"
            >
              {isLoading ? "Loading..." : "Start Editing"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={handleBack}
            >
              ← Back to Topics
            </Button>
            <h1 className="text-3xl font-bold text-medical-dark">{selectedTopic}</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => addItem("0", false)} 
              variant="outline"
            >
              Add New Topic
            </Button>
            {isSaving && (
              <span className="text-sm text-gray-500">Saving changes...</span>
            )}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-dark" />
            </div>
          ) : (
            <DndProvider backend={HTML5Backend}>
              {renderTopicNodes(null)}
            </DndProvider>
          )}
        </div>
      </div>
    </div>
  )
}

