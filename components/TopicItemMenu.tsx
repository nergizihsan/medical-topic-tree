"use client"

import { useState } from "react"
import { MoreHorizontal, Trash2, ArrowRightLeft, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MEDICAL_TOPICS, MedicalTopic } from "@/lib/constants"
import { useTopicStore } from "@/stores/useTopicStore"
import type { TopicItem } from "@/types/topic"
import { toast } from "sonner"


interface TopicItemMenuProps {
  item: TopicItem
  onDeleteItem: (id: string) => void
  onCreateRelation: () => void
}


export function TopicItemMenu({ item, onDeleteItem, onCreateRelation }: TopicItemMenuProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<MedicalTopic | "">("")
  const changeTopicSubject = useTopicStore(state => state.changeTopicSubject)
  const currentTopic = useTopicStore(state => state.selectedTopic)
  const hasRelationship = useTopicStore(state => state.hasRelationship)
  const deleteRelationship = useTopicStore(state => state.deleteRelationship)
  const moveItemUp = useTopicStore(state => state.moveItemUp)

  const handleChangeSubject = async () => {
    if (selectedTopic && selectedTopic !== currentTopic) {
      const result = await changeTopicSubject(item.id, selectedTopic)
      if (result.success) {
        toast.success(result.message)
        setIsDialogOpen(false)
      } else {
        toast.error(result.message)
      }
    }
  }

  const handleDeleteRelationship = async () => {
    const result = await deleteRelationship(item.id)
    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }

  }

  const handleTopicChange = (value: MedicalTopic) => {
    setSelectedTopic(value)
  }

  const handleMoveUp = async () => {
    console.log('handleMoveUp called for item:', item)
    try {
      const response = await moveItemUp(item.id)
      console.log('moveItemUp response:', response)
      if (response.success) {
        toast.success(response.message)
      } else {
        toast.error(response.message)
      }
    } catch (error) {
      console.error('moveItemUp error:', error)
      toast.error(error instanceof Error ? error.message : "Failed to move item up")
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.item_level > 1 && (
            <DropdownMenuItem onClick={handleMoveUp}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Move to Upper Level
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
          {item.item_level === 1 && (
            <>
              <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Change Topic
              </DropdownMenuItem>
              {hasRelationship(item.id) ? (
                <DropdownMenuItem onClick={handleDeleteRelationship}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Delete Relationship
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={onCreateRelation}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Create Relationship
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteItem(item.id);
                setIsDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Topic</DialogTitle>
            <DialogDescription>
              Move this item and its children to another medical topic.
            </DialogDescription>
          </DialogHeader>
          
          <Select value={selectedTopic} onValueChange={handleTopicChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select new topic" />
            </SelectTrigger>
            <SelectContent>
              {MEDICAL_TOPICS
                .filter(topic => topic !== currentTopic)
                .map((topic) => (
                  <SelectItem key={topic} value={topic}>
                    {topic}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangeSubject}
              disabled={!selectedTopic || selectedTopic === currentTopic}
            >
              Change Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
} 