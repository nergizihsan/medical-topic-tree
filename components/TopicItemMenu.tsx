"use client"

import { useState } from "react"
import { MoreHorizontal, Trash2, ArrowRightLeft } from "lucide-react"
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
}

export function TopicItemMenu({ item, onDeleteItem }: TopicItemMenuProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<MedicalTopic | "">("")
  const changeTopicSubject = useTopicStore(state => state.changeTopicSubject)
  const currentTopic = useTopicStore(state => state.selectedTopic)

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

  const handleTopicChange = (value: MedicalTopic) => {
    setSelectedTopic(value)
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
          <DropdownMenuItem
            onClick={() => onDeleteItem(item.id)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
          {item.item_level === 1 && (
            <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Change Topic
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

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