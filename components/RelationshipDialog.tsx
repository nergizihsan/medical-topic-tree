import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TopicItem } from "@/types/topic"
import { useTopicStore } from "@/stores/useTopicStore"

interface RelationshipDialogProps {
  isOpen: boolean
  onClose: () => void
  sourceItem: TopicItem
  availableItems: TopicItem[]
  onCreateRelation: (sourceId: string, targetId: string, type: string) => Promise<void>
}

export function RelationshipDialog({
  isOpen,
  onClose,
  sourceItem,
  availableItems,
  onCreateRelation,
}: RelationshipDialogProps) {
  const [selectedItem, setSelectedItem] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const hasRelationship = useTopicStore(state => state.hasRelationship)

  const filteredItems = availableItems
    .filter(item => 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !hasRelationship(item.id) &&
      item.item_level === 1  // Only show level 1 items
    )
    .slice(0, 10)

  const handleCreate = async () => {
    if (!selectedItem) return
    await onCreateRelation(sourceItem.id, selectedItem, 'related')
    onClose()
    setSearchQuery("")
    setSelectedItem("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Relationship</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search Level 1 Items</label>
            <Input
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mb-2"
            />
            <div className="max-h-60 overflow-y-auto space-y-1">
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item.id)}
                    className={`p-2 rounded cursor-pointer ${
                      selectedItem === item.id
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {item.item_name}
                  </div>
                ))
              ) : (
                <div className="p-2 text-sm text-gray-500">
                  No available items found. Items must be level 1 and not have existing relationships.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => {
            onClose()
            setSearchQuery("")
            setSelectedItem("")
          }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!selectedItem}>
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}