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
  hierarchy_analysis?: HierarchyAnalysis
}

export interface DragItem {
  id: string  // Changed from number to string
  type: string
}

// Server-side interface with Date
interface ServerHierarchyAnalysis {
  suggested_hierarchies: SuggestedHierarchy[]
  missing_items: MissingItem[]
  analyzed_at: Date
}

// Client-side interface with string date
export interface HierarchyAnalysis {
  suggested_hierarchies: SuggestedHierarchy[]
  missing_items: MissingItem[]
  analyzed_at: string  // Changed from Date to string for client-side
}

// Update TopicTree to use server-side version
export interface TopicTree {
  topic_name: string
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
  }[]
  hierarchy_analysis?: ServerHierarchyAnalysis  // Use server version with Date
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

export interface SuggestedHierarchy {
  child_items: string[]
  is_new_group: boolean
  parent_item: string
  reasoning: string
}

export interface MissingItem {
  importance: string
  related_existing_items: string[]
  suggested_item: string
}

