"use server"

import { getDb, withTransaction } from "@/lib/mongodb"
import type { TopicTree, ActionResponse } from "@/types/topic"
import { ObjectId } from "mongodb"


export async function fetchTopicTree(topicName: string) {
  try {
    const db = await getDb()
    
    const topicTree = await db
      .collection<TopicTree>("topic_trees")
      .findOne({ topic_name: topicName })

    if (!topicTree) {
      throw new Error("Topic not found")
    }

    // Sort items by item_name (A to Z)
    const sortedItems = [...topicTree.items].sort((a, b) => 
      a.item_name.localeCompare(b.item_name)
    )

    // Transform server ObjectIds to client strings
    const clientItems = sortedItems.map(item => ({
      ...item,
      item_id: item.item_id.toString(),
      parent_item_id: item.parent_item_id?.toString() || null
    }))

    return { ...topicTree, items: clientItems }
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
}

export async function updateTopicTree(topicName: string, items: any[]) {
  try {
    const db = await getDb()
    
    // Get the current document to preserve existing item_types
    const currentDoc = await db
      .collection<TopicTree>("topic_trees")
      .findOne({ topic_name: topicName })

    // Create a map of item_id to item_type from existing items
    const itemTypeMap = new Map(
      currentDoc?.items.map((item: any) => [item.item_id, item.item_type])
    )
    
    // Transform items to MongoDB format, converting string IDs to ObjectIds
    const transformedItems = items.map(item => ({
      item_id: new ObjectId(item.id),
      item_level: item.item_level,
      item_type: itemTypeMap.get(item.id) || "cks_topic",
      item_name: item.item_name,
      parent_item_id: item.parent_element_id ? new ObjectId(item.parent_element_id) : null
    }))

    const result = await db
      .collection<TopicTree>("topic_trees")
      .updateOne(
        { topic_name: topicName },
        { $set: { items: transformedItems } }
      )

    if (result.matchedCount === 0) {
      throw new Error("Topic not found")
    }

    return { success: true }
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
}

export async function addTopicItem(
  topicName: string, 
  newItem: {
    id: string,
    item_name: string,
    item_level: number,
    parent_element_id: string | null
  }
) {
  try {
    const db = await getDb()
    
    const transformedItem = {
      item_id: new ObjectId(newItem.id),
      item_level: newItem.item_level,
      item_type: null,
      item_name: newItem.item_name,
      parent_item_id: newItem.parent_element_id ? new ObjectId(newItem.parent_element_id) : null
    }

    const result = await db
      .collection<TopicTree>("topic_trees")
      .updateOne(
        { topic_name: topicName },
        { $push: { items: transformedItem } }
      )

    if (result.matchedCount === 0) {
      throw new Error("Topic not found")
    }

    return { success: true }
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
}

export async function changeItemSubject(
  fromTopic: string,
  toTopic: string,
  itemId: string
): Promise<ActionResponse> {
  try {
    const db = await getDb()
    
    // Get both source and target topic trees
    const [sourceTree, targetTree] = await Promise.all([
      db.collection<TopicTree>("topic_trees").findOne({ topic_name: fromTopic }),
      db.collection<TopicTree>("topic_trees").findOne({ topic_name: toTopic })
    ])

    if (!sourceTree || !targetTree) {
      return {
        success: false,
        message: "Failed to move item",
        error: "One or both topics not found"
      }
    }

    // Find the item and its descendants
    const itemsToMove = new Set<string>([itemId])
    let foundNew = true

    while (foundNew) {
      foundNew = false
      sourceTree.items.forEach((item) => {
        if (item.parent_item_id !== null && 
            itemsToMove.has(item.parent_item_id.toString()) && 
            !itemsToMove.has(item.item_id.toString())) {
          itemsToMove.add(item.item_id.toString())
          foundNew = true
        }
      })
    }

    // Separate items to move and items to keep
    const itemsToKeep = sourceTree.items.filter(item => !itemsToMove.has(item.item_id.toString()))
    const movingItems = sourceTree.items.filter(item => itemsToMove.has(item.item_id.toString()))

    // Use withTransaction helper
    await withTransaction(async (session) => {
      // Remove items from source topic
      await db.collection<TopicTree>("topic_trees").updateOne(
        { topic_name: fromTopic },
        { $set: { items: itemsToKeep } },
        { session }
      )

      // Add items to target topic
      await db.collection<TopicTree>("topic_trees").updateOne(
        { topic_name: toTopic },
        { $push: { items: { $each: movingItems } } },
        { session }
      )
    })

    return {
      success: true,
      message: "Successfully moved item to new topic"
    }
  } catch (error) {
    console.error('Database error:', error)
    return {
      success: false,
      message: "Failed to move item",
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}

export async function deleteTopicItem(topicName: string, itemId: string): Promise<ActionResponse> {
  try {
    const db = await getDb()
    const result = await db
      .collection<TopicTree>("topic_trees")
      .updateOne(
        { topic_name: topicName },
        { $pull: { items: { item_id: new ObjectId(itemId) } } }
      )

    if (result.matchedCount === 0) {
      return {
        success: false,
        message: "Failed to delete item",
        error: "Topic not found"
      }
    }

    return {
      success: true,
      message: "Successfully deleted item"
    }
  } catch (error) {
    console.error('Database error:', error)
    return {
      success: false,
      message: "Failed to delete item",
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }
  }
}