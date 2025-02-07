"use client"

import { useEffect, useState } from "react"
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
import { AddItemDialog } from "@/components/AddItemDialog"
import { PanelRightOpen, PanelRightClose, ChevronDown, ChevronRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { AlertCircle } from "lucide-react"

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
    createRelationship,
    analysisData,
    isAnalysisLoading,
    isAnalysisPanelOpen,
    fetchAnalysis,
    isItemInTree,
  } = useTopicStore()

  const [tempTopic, setTempTopic] = useState<MedicalTopic | "">("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isMissingTopicsOpen, setIsMissingTopicsOpen] = useState(true)
  const [isSuggestedGroupsOpen, setIsSuggestedGroupsOpen] = useState(true)

  useEffect(() => {
    if (initialTopic && initialItems) {
      setSelectedTopic(initialTopic as MedicalTopic)
      setItems(initialItems)
    }
  }, [initialTopic, initialItems, setSelectedTopic, setItems])

  // Show loading state when we have initialTopic but waiting for data
  if (initialTopic && (!selectedTopic || items.length === 0)) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-emerald-50/50 to-blue-50/50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-emerald-700 font-medium">Loading {initialTopic} topic data...</p>
      </div>
    )
  }

  // Show topic selection only if no topic is selected and no initial topic
  if (!initialTopic && (!selectedTopic || items.length === 0)) {
    return (
      <div className="flex flex-col items-center min-h-screen p-16">
        <h1 className="text-3xl font-bold text-medical-dark mb-8">Medical Topic Tree</h1>
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h2 className="text-xl font-semibold mb-6 text-center">Select a Medical Topic</h2>
          <div className="space-y-4">
            <Select value={tempTopic} onValueChange={(value) => setTempTopic(value as MedicalTopic)}>
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
              onClick={() => {
                const params = new URLSearchParams(searchParams)
                if (tempTopic) {
                  params.set("topic", tempTopic)
                } else {
                  params.delete("topic")
                }
                router.push(`?${params.toString()}`)
                setSelectedTopic(tempTopic)
                fetchTopic()
              }} 
              disabled={!tempTopic || isLoading}
              className="w-full"
            >
              {isLoading ? "Loading..." : "Start Editing"}
            </Button>
          </div>
        </div>
      </div>
    )
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

  const handleAddRootItem = async (name: string) => {
    await addItem("0", false, name)
  }

  const handleCreateRelation = async (sourceId: string, targetId: string, type: string) => {
    const result = await createRelationship(sourceId, targetId, type)
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }
  }

  const relationships = items.reduce((acc, item) => {
    if (item.relationships) {
      return [
        ...acc,
        ...item.relationships.map(rel => ({
          sourceId: item.id,
          targetId: rel.targetId,
          type: rel.type
        }))
      ]
    }
    return acc
  }, [] as Array<{ sourceId: string; targetId: string; type: string }>)

  const renderTopicNodes = (parentId: string | null = null) => {
    const itemsToRender = items
      .filter(item => item.parent_element_id === parentId)
      .sort((a, b) => {
        // For level 1 items, respect the order_index which is set by the backend
        // based on relationships and alphabetical order
        if (a.item_level === 1 && b.item_level === 1) {
          return (a.order_index ?? 0) - (b.order_index ?? 0)
        }
        
        // For nested items, sort by order_index first, then alphabetically
        if (a.order_index !== b.order_index) {
          return (a.order_index ?? 0) - (b.order_index ?? 0)
        }
        return a.item_name.localeCompare(b.item_name)
      })

    return itemsToRender.map(item => (
      <div key={item.id} style={{ marginLeft: `${item.item_level * 20}px` }}>
        <TopicNode
          item={item}
          items={items}
          onAddItem={addItem}
          onUpdateName={updateItemName}
          onDeleteItem={handleDelete}
          onMoveItem={moveItem}
          onCreateRelation={handleCreateRelation}
          relationships={relationships}
        />
        {renderTopicNodes(item.id)}
      </div>
    ))
  }

  const handleAnalysisClick = async () => {
    await fetchAnalysis()
  }

  return (
    <div className="p-8 bg-gradient-to-br from-emerald-50/50 to-blue-50/50 min-h-screen">
      <div className={cn(
        "mx-auto relative transition-all duration-300",
        isAnalysisPanelOpen ? "max-w-[90vw]" : "max-w-4xl"
      )}>
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="hover:bg-blue-50 hover:border-blue-200 transition-all duration-200"
            >
              ← Back to Topics
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 text-transparent bg-clip-text">
              {selectedTopic}
            </h1>
            <Button
              onClick={handleAnalysisClick}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isAnalysisLoading}
            >
              {isAnalysisLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-500 border-t-transparent" />
              ) : isAnalysisPanelOpen ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
              {isAnalysisLoading ? "Loading..." : isAnalysisPanelOpen ? "Close Analysis" : "Show Analysis"}
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setIsAddDialogOpen(true)} 
              variant="outline"
              className="bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white border-0 transition-all duration-200"
            >
              Add New Item
            </Button>
            {isSaving && (
              <span className="text-sm text-emerald-600 animate-pulse">Saving changes...</span>
            )}
          </div>
        </div>
        
        <div className="flex gap-6">
          {/* Main content */}
          <div className={cn(
            "bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-6 transition-all duration-300 hover:shadow-xl",
            isAnalysisPanelOpen ? "flex-1" : "w-full"
          )}>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : (
              <DndProvider backend={HTML5Backend}>
                <div className="space-y-1">
                  {renderTopicNodes(null)}
                </div>
              </DndProvider>
            )}
          </div>

          {/* Analysis Panel */}
          {isAnalysisPanelOpen && analysisData && (
            <div className="w-[400px] bg-white/80 backdrop-blur-sm rounded-lg shadow-lg p-6 space-y-6 h-[calc(100vh-12rem)] overflow-y-auto sticky top-8">
              <div className="space-y-6">
                {/* Missing Items - Now First */}
                <div>
                  <button
                    onClick={() => setIsMissingTopicsOpen(!isMissingTopicsOpen)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    {isMissingTopicsOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <h3 className="text-lg font-semibold text-amber-700">Missing Topics</h3>
                  </button>
                  
                  {isMissingTopicsOpen && (
                    <div className="space-y-4 mt-4">
                      {analysisData.missing_items
                        .filter(item => !isItemInTree(item.suggested_item))
                        .map((item, index) => (
                          <div key={index} className="bg-amber-50 rounded-lg border border-amber-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <h4 className="font-medium">{item.suggested_item}</h4>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white hover:text-white border-0 px-3 text-xs font-medium"
                                onClick={() => handleAddRootItem(item.suggested_item)}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add
                              </Button>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{item.importance}</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="text-sm text-gray-500">Related to:</span>
                              {item.related_existing_items.map((related, i) => (
                                <Badge key={i} variant="secondary" className="bg-white">
                                  {related}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Suggested Hierarchies */}
                <div>
                  <button
                    onClick={() => setIsSuggestedGroupsOpen(!isSuggestedGroupsOpen)}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    {isSuggestedGroupsOpen ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <h3 className="text-lg font-semibold text-emerald-700">Suggested Groups</h3>
                  </button>
                  
                  {isSuggestedGroupsOpen && (
                    <div className="space-y-4 mt-4">
                      {analysisData.suggested_hierarchies.map((hierarchy, index) => (
                        <div 
                          key={index} 
                          className="rounded-lg border border-gray-200 bg-white p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{hierarchy.parent_item}</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{hierarchy.reasoning}</p>
                          <div className="flex flex-wrap gap-2">
                            {hierarchy.child_items.map((item, i) => (
                              <Badge key={i} variant="secondary" className="bg-blue-50">
                                {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 pt-4 border-t">
                  Last analyzed: {new Date(analysisData.analyzed_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        <AddItemDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onAdd={handleAddRootItem}
          title="Add New Root Item"
          description="Add a new top-level item to this topic"
        />
      </div>
    </div>
  )
}

