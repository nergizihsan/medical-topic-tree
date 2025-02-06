"use client"

import { useState, useRef, useEffect } from "react"
import { useDrag, useDrop } from "react-dnd"
import type { TopicItem } from "@/types/topic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, GripVertical } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { TopicItemMenu } from "@/components/TopicItemMenu"

interface TopicNodeProps {
  item: TopicItem
  onAddItem: (id: string, isChild: boolean) => void
  onUpdateName: (id: string, name: string) => void
  onDeleteItem: (id: string) => void
  onMoveItem: (dragId: string, dropId: string, isNested: boolean) => void
  isEditing?: boolean
}

const SCROLL_SPEED = 15 // pixels per frame
const SCROLL_THRESHOLD = 150 // pixels from edge to start scrolling

export default function TopicNode({
  item,
  onAddItem,
  onUpdateName,
  onDeleteItem,
  onMoveItem,
  isEditing = false,
}: TopicNodeProps) {
  const [editing, setEditing] = useState(isEditing)
  const scrollIntervalRef = useRef<number>()

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

  const [{ isOver, isOverCurrent }, drop] = useDrop({
    accept: "TOPIC_ITEM",
    drop: (draggedItem: { id: string }, monitor) => {
      if (monitor.didDrop()) return

      const isNested = monitor.isOver({ shallow: true })
      if (draggedItem.id !== item.id) {
        onMoveItem(draggedItem.id, item.id, isNested)
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      isOverCurrent: monitor.isOver({ shallow: true }),
    }),
  })

  const ref = useRef<HTMLDivElement>(null)
  drag(drop(ref))

  return (
    <div
      ref={ref}
      style={{ marginLeft: `${(item.item_level - 1) * 24}px` }}
      className={`relative p-2 my-1 rounded-lg transition-all ${
        isDragging ? "opacity-50" : "opacity-100"
      } ${
        isOver 
          ? "bg-medical-light border-2 border-medical-primary" 
          : "bg-white border border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="cursor-move text-gray-400" size={20} />
        {editing ? (
          <Input
            autoFocus
            value={item.item_name}
            onChange={(e) => onUpdateName(item.id, e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            className="flex-1"
          />
        ) : (
          <div 
            className="flex-1 p-2 cursor-pointer" 
            onDoubleClick={() => setEditing(true)}
          >
            {item.item_name || "Untitled"}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onAddItem(item.id, false)}>
              Add item after
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddItem(item.id, true)}>
              Add child item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <TopicItemMenu 
          item={item}
          onDeleteItem={onDeleteItem}
        />
      </div>
    </div>
  )
}

