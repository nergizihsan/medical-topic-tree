"use server"

import { getDb, withTransaction } from "@/lib/mongodb"
import type { TopicTree, ActionResponse } from "@/types/topic"
import { ObjectId } from "mongodb"

// Utility function for reindexing a document
async function reindexDocument(topicName: string, session?: any) {
  const db = await getDb()
  const operation = session ? { session } : {}
  
  const topic = await db
    .collection<TopicTree>("topic_trees")
    .findOne({ topic_name: topicName }, operation)
    
  if (!topic) throw new Error("Topic not found")

  // First, cleanup orphaned items
  const validParentIds = new Set(topic.items.map(item => item.item_id.toString()))
  const cleanedItems = topic.items.filter(item => 
    item.parent_item_id === null || 
    validParentIds.has(item.parent_item_id.toString())
  )
  
  // Get level 1 items and build relationship graph
  const level1Items = cleanedItems.filter(item => item.item_level === 1)
  const relationshipGroups = new Map<string, Set<string>>()
  
  level1Items.forEach(item => {
    const itemId = item.item_id.toString()
    if (!relationshipGroups.has(itemId)) {
      relationshipGroups.set(itemId, new Set())
    }
    
    item.relationships?.forEach(rel => {
      const targetId = rel.target_id.toString()
      if (level1Items.some(i => i.item_id.toString() === targetId)) {
        relationshipGroups.get(itemId)!.add(targetId)
        if (!relationshipGroups.has(targetId)) {
          relationshipGroups.set(targetId, new Set())
        }
        relationshipGroups.get(targetId)!.add(itemId)
      }
    })
  })

  // Create ordered list of level 1 items
  const orderedItems: string[] = []
  const processedIds = new Set<string>()

  // First, collect related items together
  level1Items.forEach(item => {
    const itemId = item.item_id.toString()
    if (processedIds.has(itemId)) return

    const relatedItems = Array.from(relationshipGroups.get(itemId) || [])
    if (relatedItems.length > 0) {
      const itemGroup = [itemId, ...relatedItems]
        .filter(id => !processedIds.has(id))
        .sort((a, b) => {
          const itemA = level1Items.find(i => i.item_id.toString() === a)!
          const itemB = level1Items.find(i => i.item_id.toString() === b)!
          return itemA.item_name.localeCompare(itemB.item_name)
        })

      itemGroup.forEach(id => {
        orderedItems.push(id)
        processedIds.add(id)
      })
    }
  })

  // Then add remaining level 1 items alphabetically
  level1Items
    .filter(item => !processedIds.has(item.item_id.toString()))
    .sort((a, b) => a.item_name.localeCompare(b.item_name))
    .forEach(item => {
      orderedItems.push(item.item_id.toString())
      processedIds.add(item.item_id.toString())
    })

  const updatedItems = [...topic.items]
  
  // Update level 1 items
  orderedItems.forEach((itemId, index) => {
    const itemIndex = updatedItems.findIndex(
      item => item.item_id.toString() === itemId
    )
    if (itemIndex !== -1) {
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        order_index: (index + 1) * 1000
      }
    }
  })

  // Handle nested levels differently
  const processNestedItems = (parentId: string | null, level: number) => {
    const children = topic.items.filter(
      item => item.item_level === level && 
      item.parent_item_id?.toString() === parentId?.toString()
    )

    if (children.length > 10) {
      throw new Error(`Too many items (${children.length}) at level ${level} under parent ${parentId}. Maximum is 10.`)
    }

    children
      .sort((a, b) => a.item_name.localeCompare(b.item_name))
      .forEach((item, index) => {
        const itemIndex = updatedItems.findIndex(
          i => i.item_id.toString() === item.item_id.toString()
        )
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            order_index: (level * 100) + (index * 10)
          }
          // Process this item's children
          processNestedItems(item.item_id.toString(), level + 1)
        }
      })
  }

  // Process all level 1 items' children
  orderedItems.forEach(itemId => {
    processNestedItems(itemId, 2)
  })

  // Update with session if provided
  await db.collection<TopicTree>("topic_trees").updateOne(
    { topic_name: topicName },
    { $set: { items: updatedItems } },
    operation
  )

  return updatedItems
}

// Fetch topic tree (no changes needed as it's read-only)
export async function fetchTopicTree(topicName: string) {
  try {
    const db = await getDb()
    const topicTree = await db
      .collection<TopicTree>("topic_trees")
      .findOne({ topic_name: topicName })

    if (!topicTree) {
      throw new Error("Topic not found")
    }

    const clientItems = topicTree.items.map(item => ({
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
    
    return await withTransaction(async (session) => {
      const existingTopic = await db
        .collection<TopicTree>("topic_trees")
        .findOne({ topic_name: topicName })

      if (!existingTopic) {
        throw new Error("Topic not found")
      }

      // Transform items while preserving relationships and maintaining hierarchy
      const transformedItems = items.map(item => {
        const existingItem = existingTopic.items.find(
          ei => ei.item_id.toString() === item.id
        )

        return {
          item_id: new ObjectId(item.id),
          item_level: item.item_level,
          item_type: item.item_type,
          item_name: item.item_name,
          parent_item_id: item.parent_element_id ? new ObjectId(item.parent_element_id) : null,
          link: item.link,
          pdfLink: item.pdfLink,
          notes: item.notes,
          relationships: existingItem?.relationships || [],
          order_index: item.order_index || 0 // Preserve existing order
        }
      })

      // Update items within transaction
      await db.collection<TopicTree>("topic_trees").updateOne(
        { topic_name: topicName },
        { $set: { items: transformedItems } },
        { session }
      )

      // Reindex within the same transaction
      const reindexedItems = await reindexDocument(topicName, session)
      
      return { 
        success: true,
        items: reindexedItems
      }
    })
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
}

// Add new item
export async function addTopicItem(
  topicName: string, 
  newItem: {
    item_name: string,
    item_level: number,
    parent_element_id: string | null,
    item_type: string | null,
    order_index?: number,
    link?: string | null,
    pdfLink?: string | null,
    notes?: string | null  // Make notes optional to match TopicItem interface
  }
) {
  try {
    // Check item limit before proceeding
    if (newItem.item_level > 1) {
      await checkNestedItemLimit(
        topicName, 
        newItem.parent_element_id,
        newItem.item_level
      )
    }

    const db = await getDb()
    
    const transformedItem = {
      item_id: new ObjectId(),
      item_level: newItem.item_level,
      item_type: newItem.item_type,
      item_name: newItem.item_name,
      notes: newItem.notes || null,  // Ensure notes is never undefined
      order_index: newItem.order_index || 0,
      link: newItem.link || null,
      pdfLink: newItem.pdfLink || null,
      parent_item_id: newItem.parent_element_id ? new ObjectId(newItem.parent_element_id) : null
    }

    await db.collection<TopicTree>("topic_trees").updateOne(
      { topic_name: topicName },
      { $push: { items: transformedItem } }
    )

    // Reindex the document to set proper order
    const updatedItems = await reindexDocument(topicName)
    const updatedItem = updatedItems.find(
      item => item.item_id.toString() === transformedItem.item_id.toString()
    )

    return { 
      success: true,
      item: {
        id: transformedItem.item_id.toString(),
        item_name: transformedItem.item_name,
        item_level: transformedItem.item_level,
        parent_element_id: transformedItem.parent_item_id?.toString() || null,
        order_index: updatedItem?.order_index || 0
      }
    }
  } catch (error) {
    console.error('Database error:', error)
    throw error
  }
}

// Change item's parent/level
export async function changeItemSubject(
  fromTopic: string,
  toTopic: string,
  itemId: string
): Promise<ActionResponse> {
  try {
    const db = await getDb()
    
    const [sourceTopic, targetTopic] = await Promise.all([
      db.collection<TopicTree>("topic_trees").findOne({ topic_name: fromTopic }),
      db.collection<TopicTree>("topic_trees").findOne({ topic_name: toTopic })
    ])

    if (!sourceTopic || !targetTopic) {
      return {
        success: false,
        message: "Failed to move item",
        error: "One or both topics not found"
      }
    }

    // Verify this is a level 1 item
    const sourceItem = sourceTopic.items.find(item => item.item_id.toString() === itemId)
    if (!sourceItem || sourceItem.item_level !== 1) {
      return {
        success: false,
        message: "Failed to move item",
        error: "Only top-level items can be moved between topics"
      }
    }

    // Find all items to move (including children)
    const itemsToMove = new Set<string>([itemId])
    let foundNew = true

    while (foundNew) {
      foundNew = false
      sourceTopic.items.forEach((item) => {
        if (item.parent_item_id !== null && 
            itemsToMove.has(item.parent_item_id.toString()) && 
            !itemsToMove.has(item.item_id.toString())) {
          itemsToMove.add(item.item_id.toString())
          foundNew = true
        }
      })
    }

    // Get moving items and clear their relationships
    const movingItems = sourceTopic.items
      .filter(item => itemsToMove.has(item.item_id.toString()))
      .map(item => ({
        ...item,
        relationships: [] // Clear relationships as they won't be valid in new topic
      }))

    // Remove items and their relationship references from source
    const itemsToKeep = sourceTopic.items
      .filter(item => !itemsToMove.has(item.item_id.toString()))
      .map(item => ({
        ...item,
        relationships: item.relationships?.filter(
          rel => !itemsToMove.has(rel.target_id.toString())
        ) || []
      }))

    // Move items between topics
    await withTransaction(async (session) => {
      await db.collection<TopicTree>("topic_trees").updateOne(
        { topic_name: fromTopic },
        { $set: { items: itemsToKeep } },
        { session }
      )

      await db.collection<TopicTree>("topic_trees").updateOne(
        { topic_name: toTopic },
        { $push: { items: { $each: movingItems } } },
        { session }
      )
    })

    // Reindex both topics
    await Promise.all([
      reindexDocument(fromTopic),
      reindexDocument(toTopic)
    ])

    return {
      success: true,
      message: "Successfully moved item to new topic"
    }
  } catch (error) {
    console.error('Database error:', error)
    return {
      success: false,
      message: "Failed to move item",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// Create relationship between items
export async function createTopicRelationship(
  topicName: string,
  sourceId: string,
  targetId: string,
): Promise<ActionResponse> {
  try {
    const db = await getDb()
    const topic = await db.collection<TopicTree>("topic_trees").findOne({ topic_name: topicName })
    
    if (!topic) {
      return {
        success: false,
        message: "Topic not found"
      }
    }

    // Check if source or target already has a relationship
    const sourceItem = topic.items.find(item => item.item_id.toString() === sourceId)
    const targetItem = topic.items.find(item => item.item_id.toString() === targetId)

    if (!sourceItem || !targetItem) {
      return {
        success: false,
        message: "One or both items not found"
      }
    }

    if (sourceItem.relationships?.length || targetItem.relationships?.length) {
      return {
        success: false,
        message: "One or both items already have a relationship"
      }
    }

    // Create bidirectional relationships
    await withTransaction(async (session) => {
      // Update source item
      await db.collection<TopicTree>("topic_trees").updateOne(
        { 
          topic_name: topicName,
          "items.item_id": new ObjectId(sourceId)
        },
        {
          $push: {
            "items.$.relationships": {
              target_id: new ObjectId(targetId),
              relationship_type: "related"
            }
          }
        },
        { session }
      )

      // Update target item
      await db.collection<TopicTree>("topic_trees").updateOne(
        { 
          topic_name: topicName,
          "items.item_id": new ObjectId(targetId)
        },
        {
          $push: {
            "items.$.relationships": {
              target_id: new ObjectId(sourceId),
              relationship_type: "related"
            }
          }
        },
        { session }
      )
    })

    // Reindex to update order based on new relationship
    await reindexDocument(topicName)

    return {
      success: true,
      message: "Relationship created successfully"
    }
  } catch (error) {
    console.error('Database error:', error)
    return {
      success: false,
      message: "Failed to create relationship",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// Delete relationship
export async function deleteTopicRelationship(
  topicName: string,
  sourceId: string,
): Promise<ActionResponse> {
  try {
    const db = await getDb()
    const topic = await db.collection<TopicTree>("topic_trees").findOne({ topic_name: topicName })
    
    if (!topic) {
      return {
        success: false,
        message: "Topic not found"
      }
    }

    // Find the source item and its related target
    const sourceItem = topic.items.find(item => item.item_id.toString() === sourceId)
    if (!sourceItem || !sourceItem.relationships?.length) {
      return {
        success: false,
        message: "Source item or relationship not found"
      }
    }

    const targetId = sourceItem.relationships[0].target_id.toString()

    // Clear relationships for both items using a transaction
    await withTransaction(async (session) => {
      // Clear source item's relationships
      await db.collection<TopicTree>("topic_trees").updateOne(
        { 
          topic_name: topicName,
          "items.item_id": new ObjectId(sourceId)
        },
        {
          $set: {
            "items.$.relationships": []
          }
        },
        { session }
      )

      // Clear target item's relationships
      await db.collection<TopicTree>("topic_trees").updateOne(
        { 
          topic_name: topicName,
          "items.item_id": new ObjectId(targetId)
        },
        {
          $set: {
            "items.$.relationships": []
          }
        },
        { session }
      )
    })

    // Reindex to update order
    await reindexDocument(topicName)

    return {
      success: true,
      message: "Relationship deleted successfully"
    }
  } catch (error) {
    console.error('Database error:', error)
    return {
      success: false,
      message: "Failed to delete relationship",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// Delete item and its children
export async function deleteTopicItem(
  topicName: string,
  itemId: string
): Promise<ActionResponse> {
  try {
    const db = await getDb()
    const topic = await db.collection<TopicTree>("topic_trees").findOne({ topic_name: topicName })
    
    if (!topic) {
      return {
        success: false,
        message: "Topic not found"
      }
    }

    // Find all items to delete (including children)
    const itemsToDelete = new Set<string>([itemId])
    let foundNew = true

    while (foundNew) {
      foundNew = false
      topic.items.forEach((item) => {
        if (item.parent_item_id !== null && 
            itemsToDelete.has(item.parent_item_id.toString()) && 
            !itemsToDelete.has(item.item_id.toString())) {
          itemsToDelete.add(item.item_id.toString())
          foundNew = true
        }
      })
    }

    // Remove items and any relationships pointing to them
    const updatedItems = topic.items
      .filter(item => !itemsToDelete.has(item.item_id.toString()))
      .map(item => ({
        ...item,
        relationships: item.relationships?.filter(
          rel => !itemsToDelete.has(rel.target_id.toString())
        )
      }))

    await db.collection<TopicTree>("topic_trees").updateOne(
      { topic_name: topicName },
      { $set: { items: updatedItems } }
    )

    // Reindex to clean up ordering
    await reindexDocument(topicName)

    return {
      success: true,
      message: "Item deleted successfully"
    }
  } catch (error) {
    console.error('Database error:', error)
    return {
      success: false,
      message: "Failed to delete item",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

async function checkNestedItemLimit(
  topicName: string, 
  parentId: string | null,
  level: number
): Promise<boolean> {
  const db = await getDb()
  const topic = await db.collection<TopicTree>("topic_trees").findOne({ topic_name: topicName })
  
  if (!topic) throw new Error("Topic not found")
  
  const siblings = topic.items.filter(
    item => item.item_level === level && 
    item.parent_item_id?.toString() === parentId
  )

  if (siblings.length >= 10) {
    throw new Error(`Cannot add more items at level ${level}. Maximum of 10 items reached.`)
  }

  return true
}

// Move item up one level
export async function moveItemUpLevel(
  topicName: string,
  itemId: string
): Promise<ActionResponse> {
  console.log('moveItemUpLevel called with:', { topicName, itemId })
  try {
    const db = await getDb()
    const topic = await db.collection<TopicTree>("topic_trees").findOne({ topic_name: topicName })
    console.log('Found topic:', topic ? 'yes' : 'no')
    
    if (!topic) {
      return {
        success: false,
        message: "Topic not found"
      }
    }

    // Find the item and its current parent
    const item = topic.items.find(i => i.item_id.toString() === itemId)
    console.log('Found item:', item)
    
    if (!item) {
      return {
        success: false,
        message: "Item not found"
      }
    }

    if (item.item_level === 1) {
      return {
        success: false,
        message: "Item is already at top level"
      }
    }

    // Find the current parent to get its parent (new parent)
    const currentParent = topic.items.find(i => 
      i.item_id.toString() === item.parent_item_id?.toString()
    )

    const newParentId = currentParent?.parent_item_id || null
    const newLevel = item.item_level - 1

    // Only check sibling limit if the new level is not 1
    if (newLevel > 1) {
      const targetSiblings = topic.items.filter(i => 
        i.item_level === newLevel && 
        i.parent_item_id?.toString() === newParentId?.toString()
      )

      if (targetSiblings.length >= 10) {
        return {
          success: false,
          message: `Cannot move item. Maximum of 10 items reached at target level.`
        }
      }
    }

    // Get all descendant items recursively
    const getAllDescendants = (parentId: string): string[] => {
      const children = topic.items
        .filter(i => i.parent_item_id?.toString() === parentId)
        .map(i => i.item_id.toString())
      
      const descendants = [...children]
      children.forEach(childId => {
        descendants.push(...getAllDescendants(childId))
      })
      
      return descendants
    }

    const descendantIds = getAllDescendants(itemId)
    console.log('Found descendants:', descendantIds)

    // Update the item and all its descendants using a transaction
    await withTransaction(async (session) => {
      // Update the main item
      await db.collection<TopicTree>("topic_trees").updateOne(
        { 
          topic_name: topicName,
          "items.item_id": item.item_id
        },
        {
          $set: {
            "items.$.item_level": newLevel,
            "items.$.parent_item_id": newParentId
          }
        },
        { session }
      )

      // Update all descendant items (reduce their level by 1)
      if (descendantIds.length > 0) {
        await db.collection<TopicTree>("topic_trees").updateMany(
          { 
            topic_name: topicName,
            "items.item_id": { $in: descendantIds.map(id => new ObjectId(id)) }
          },
          {
            $inc: { "items.$[elem].item_level": -1 }
          },
          { 
            session,
            arrayFilters: [{ "elem.item_id": { $in: descendantIds.map(id => new ObjectId(id)) } }]
          }
        )
      }
    })

    // After transaction
    console.log('Transaction completed, reindexing...')
    await reindexDocument(topicName)
    console.log('Reindexing completed')

    return {
      success: true,
      message: "Item moved up successfully"
    }
  } catch (error) {
    console.error('moveItemUpLevel error:', error)
    return {
      success: false,
      message: "Failed to move item up",
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}