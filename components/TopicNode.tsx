"use client"

import { useState, useRef, useEffect } from "react"
import { useDrag, useDrop } from "react-dnd"
import type { TopicItem } from "@/types/topic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, GripVertical, ExternalLink, Link2, ChevronDown, ChevronRight } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TopicItemMenu } from "@/components/TopicItemMenu"
import { useTopicStore } from "@/stores/useTopicStore"
import { AddItemDialog } from "@/components/AddItemDialog"
import { RelationshipDialog } from "@/components/RelationshipDialog"
import { Textarea } from "@/components/ui/textarea"

interface TopicNodeProps {
  item: TopicItem
  onAddItem: (id: string, isChild: boolean, name: string) => void
  onUpdateName: (id: string, name: string) => void
  onDeleteItem: (id: string) => void
  onMoveItem: (dragId: string, dropId: string, isNested: boolean) => void
  onCreateRelation: (sourceId: string, targetId: string, type: string) => Promise<void>
  items?: TopicItem[]
  relationships?: Array<{
    sourceId: string
    targetId: string
    type: string
  }>
}

const SCROLL_SPEED = 15 // pixels per frame
const SCROLL_THRESHOLD = 150 // pixels from edge to start scrolling

export default function TopicNode({
  item,
  onAddItem,
  onUpdateName,
  onDeleteItem,
  onMoveItem,
  onCreateRelation,
  items = [],
}: TopicNodeProps) {

  const isEditing = useTopicStore(state => state.isEditing === item.id)
  const setEditing = useTopicStore(state => state.setEditing)
  const tempEditValue = useTopicStore(state => state.tempEditValue)
  const setTempEditValue = useTopicStore(state => state.setTempEditValue)
  const scrollIntervalRef = useRef<number>()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isRelationshipDialogOpen, setIsRelationshipDialogOpen] = useState(false)
  const [addType, setAddType] = useState<'after' | 'child' | null>(null)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const updateItemNotes = useTopicStore(state => state.updateItemNotes)
  const [tempNotes, setTempNotes] = useState(item.notes || "")


  const handleScroll = (clientY: number) => {
    const { innerHeight } = window
    const scrollThresholdTop = SCROLL_THRESHOLD
    const scrollThresholdBottom = innerHeight - SCROLL_THRESHOLD

    if (clientY < scrollThresholdTop) {
      // Scroll up
      const intensity = Math.max(0, (scrollThresholdTop - clientY) / SCROLL_THRESHOLD)
      window.scrollBy(0, -SCROLL_SPEED * intensity)
    } else if (clientY > scrollThresholdBottom) {
      // Scroll down
      const intensity = Math.max(0, (clientY - scrollThresholdBottom) / SCROLL_THRESHOLD)
      window.scrollBy(0, SCROLL_SPEED * intensity)
    }
  }

  const [{ isDragging }, drag] = useDrag({
    type: "TOPIC_ITEM",
    item: { id: item.id, type: "TOPIC_ITEM" },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: () => {
      // Clean up scroll interval when drag ends
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current)
      }
    }
  })

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      if (isDragging && e.clientY) {
        // Request next animation frame for smooth scrolling
        scrollIntervalRef.current = requestAnimationFrame(() => {
          handleScroll(e.clientY)
        })
      }
    }

    if (isDragging) {
      document.addEventListener('dragover', handleDragOver)
    }

    return () => {
      document.removeEventListener('dragover', handleDragOver)
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current)
      }
    }
  }, [isDragging])

  const [{ isOver }, drop] = useDrop({
    accept: "TOPIC_ITEM",
    drop: (draggedItem: { id: string }, monitor) => {
      if (monitor.didDrop()) return
      const isNested = monitor.isOver({ shallow: true })
      if (draggedItem.id !== item.id) {
        onMoveItem(draggedItem.id, item.id, isNested)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver()
    }),
  })

  const ref = useRef<HTMLDivElement>(null)
  drag(drop(ref))

  const handleAdd = async (name: string) => {
    try {
      if (addType === 'after') {
        onAddItem(item.id, false, name)
      } else if (addType === 'child') {
        onAddItem(item.id, true, name)
      }
      setIsAddDialogOpen(false)
      setAddType(null)
    } catch (error) {
      console.error("Failed to add item:", error)
    }
  }

  const handleStartEdit = () => {
    setEditing(item.id)
    setTempEditValue(item.item_name)
  }

  const handleFinishEdit = async () => {
    if (tempEditValue !== null && tempEditValue !== item.item_name) {
      await onUpdateName(item.id, tempEditValue)
    }
    setEditing(null)
    setTempEditValue(null)
  }

  const handleRelationshipClick = () => {
    setIsRelationshipDialogOpen(true);
  };

  const handleCreateRelation = async (sourceId: string, targetId: string, type: string) => {
    await onCreateRelation(sourceId, targetId, type);
    setIsRelationshipDialogOpen(false);
  };

  return (
    <>
      <div
        ref={ref}
        id={`topic-${item.id}`}
        style={{ marginLeft: `${(item.item_level - 1) * 24}px` }}
        className={`relative p-2 my-1 rounded-lg transition-all duration-200 hover:shadow-md ${
          isDragging ? "opacity-50 scale-95" : "opacity-100"
        } ${
          isOver 
            ? "bg-emerald-50/80 border-2 border-emerald-400 shadow-lg" 
            : "bg-white border border-gray-200 hover:border-emerald-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <GripVertical 
            className="cursor-move text-white bg-blue-500 hover:bg-blue-600 p-1 rounded-md shadow-md transition-all hover:shadow-lg" 
            size={20} 
          />
          {isEditing ? (
            <Input
              autoFocus
              value={tempEditValue ?? item.item_name}
              onChange={(e) => setTempEditValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFinishEdit()
                } else if (e.key === "Escape") {
                  setEditing(null)
                  setTempEditValue(null)
                }
              }}
              className="flex-1"
            />
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setIsNotesOpen(!isNotesOpen)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {isNotesOpen ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
              <div 
                className="flex-1 p-2 cursor-pointer rounded hover:bg-emerald-50/50 transition-colors" 
                onDoubleClick={handleStartEdit}
              >
                {item.item_name || "Untitled"}
              </div>
              <div className="flex items-center gap-2">
                {item.link && (
                  <a 
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-md hover:shadow-lg transition-all hover:scale-105"
                    onClick={(e) => e.stopPropagation()}
                    title="View Resource"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
                {item.pdfLink && (
                  <a 
                    href={item.pdfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-md hover:shadow-lg transition-all hover:scale-105"
                    onClick={(e) => e.stopPropagation()}
                    title="View PDF"
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white hover:text-white hover:scale-105 rounded-md shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  setAddType('after')
                  setIsAddDialogOpen(true)
                }}>
                  Add item after
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setAddType('child')
                  setIsAddDialogOpen(true)
                }}>
                  Add child item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <TopicItemMenu 
              item={item}
              onDeleteItem={onDeleteItem}
              onCreateRelation={handleRelationshipClick}
            />
          </div>
        </div>

        {/* Add notes section */}
        {isNotesOpen && (
          <div className="mt-2 pl-8">
            <Textarea
              placeholder="Add notes..."
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              onBlur={() => {
                if (tempNotes !== item.notes) {
                  updateItemNotes(item.id, tempNotes)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateItemNotes(item.id, tempNotes)
                  setIsNotesOpen(false)
                } else if (e.key === "Escape") {
                  setIsNotesOpen(false)
                }
              }}
              className="min-h-[100px] text-sm"
            />
          </div>
        )}

        {/* Show related items */}
        {item.relationships && item.relationships.length > 0 && (
          <div className="mt-2 pl-8 text-sm text-gray-500">
            {item.relationships.map((rel) => {
              const targetItem = items.find(i => i.id === rel.targetId)
              return targetItem && (
                <div key={`${item.id}-${rel.targetId}`} className="flex items-center gap-2">
                  <Link2 className="h-3 w-3" />
                  <span>{rel.type}:</span>
                  <span className="font-medium">{targetItem.item_name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AddItemDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false)
          setAddType(null)
        }}
        onAdd={handleAdd}
        title={addType === 'child' ? "Add Child Item" : "Add Item After"}
        description={addType === 'child' 
          ? "Add a new child item to this topic"
          : "Add a new item after this topic"
        }
      />

      <RelationshipDialog
        isOpen={isRelationshipDialogOpen}
        onClose={() => setIsRelationshipDialogOpen(false)}
        sourceItem={item}
        availableItems={items.filter(i => i.id !== item.id)}
        onCreateRelation={handleCreateRelation}
      />
    </>
  )
}

