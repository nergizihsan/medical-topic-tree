"use server"

import { ObjectId } from "mongodb"

// Client-side interfaces (using string IDs)
export interface TopicItem {
  id: string  // Changed from number to string
  item_name: string
  item_level: number
  parent_element_id: string | null  // Changed from number to string
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
  }[];
}

export interface ActionResponse {
  success: boolean
  message: string
  error?: string
}

