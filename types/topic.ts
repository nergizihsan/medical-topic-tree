"use server"

import { ObjectId } from "mongodb"

// Client-side interfaces (using string IDs)
export interface TopicItem {
  id: string  // Changed from number to string
  item_name: string
  item_level: number
  item_type: string | null
  parent_element_id: string | null  // Changed from number to string
  link?: string | null    // Make sure these aren't optional
  pdfLink?: string | null // Remove the ? if they should always exist
  order_index?: number  // New field
  notes?: string | null  // Add this line
  relationships?: {
    targetId: string
    type: string
  }[]
}

export interface DragItem {
  id: string  // Changed from number to string
  type: string
}

// Server-side interface (using ObjectId)
export interface TopicTree {
  topic_name: string;
  items: {
    item_id: ObjectId;  // Changed from number to ObjectId
    item_level: number;
    item_type: string | null;
    item_name: string;
    parent_item_id: ObjectId | null;  // Changed from number to ObjectId
    order_index: number  // New field
    notes: string | null;  // Add this line
    relationships?: {
      target_id: ObjectId
      relationship_type: string
    }[]
  }[];
}

export interface TopicState {
  moveItemUp: (itemId: string) => Promise<ActionResponse>
}

export interface ActionResponse {
  success: boolean
  message: string
  error?: string
  item?: any // Optional item field for responses that return data
}

// Add new type for relationship operations
export interface RelationshipData {
  sourceId: string
  targetId: string
  type: string
}

