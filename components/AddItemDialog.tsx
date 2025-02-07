"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AddItemDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (name: string) => Promise<void>
  title: string
  description: string
}

export function AddItemDialog({ 
  isOpen, 
  onClose, 
  onAdd, 
  title, 
  description 
}: AddItemDialogProps) {
  const [itemName, setItemName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleAdd = async () => {
    if (!itemName.trim()) return
    
    setIsLoading(true)
    try {
      await onAdd(itemName)
      setItemName("")
      onClose()
    } catch (error) {
      console.error("Failed to add item:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <Input
          placeholder="Enter item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          autoFocus
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAdd} 
            disabled={!itemName.trim() || isLoading}
          >
            {isLoading ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 