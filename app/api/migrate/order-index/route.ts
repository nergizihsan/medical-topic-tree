import { getDb } from "@/lib/mongodb"
import type { TopicTree } from "@/types/topic"
import { NextResponse } from "next/server"

export async function GET() {
  const startTime = Date.now()
  console.log("🚀 Starting order_index migration...")
  
  try {
    const db = await getDb()
    console.log("📚 Connected to database, fetching topics...")
    
    const topics = await db.collection<TopicTree>("topic_trees").find({}).toArray()
    console.log(`📋 Found ${topics.length} topics to process`)
    
    const results = []
    let totalItemsProcessed = 0
    
    for (const topic of topics) {
      console.log(`\n⚙️ Processing topic: ${topic.topic_name} (${topic.items.length} items)`)
      
      // Add orphaned items cleanup
      const validParentIds = new Set(topic.items.map(item => item.item_id.toString()))
      const cleanedItems = topic.items.filter(item => 
        item.parent_item_id === null || 
        validParentIds.has(item.parent_item_id.toString())
      )
      
      // Get level 1 items and build relationship graph
      const level1Items = cleanedItems.filter(item => item.item_level === 1)
      console.log(`📊 Found ${level1Items.length} top-level items`)
      
      const relationshipGroups = new Map<string, Set<string>>()
      let relationshipCount = 0
      
      level1Items.forEach(item => {
        const itemId = item.item_id.toString()
        if (!relationshipGroups.has(itemId)) {
          relationshipGroups.set(itemId, new Set())
        }
        
        item.relationships?.forEach(rel => {
          const targetId = rel.target_id.toString()
          if (level1Items.some(i => i.item_id.toString() === targetId)) {
            relationshipCount++
            relationshipGroups.get(itemId)!.add(targetId)
            if (!relationshipGroups.has(targetId)) {
              relationshipGroups.set(targetId, new Set())
            }
            relationshipGroups.get(targetId)!.add(itemId)
          }
        })
      })

      console.log(`🔗 Found ${relationshipCount} relationships between top-level items`)

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
          item.parent_item_id?.toString() === parentId
        )

        if (children.length > 10) {
          console.warn(`Warning: ${children.length} items found at level ${level} under parent ${parentId}. Maximum should be 10.`)
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

      // Update the database
      await db.collection<TopicTree>("topic_trees").updateOne(
        { topic_name: topic.topic_name },
        { $set: { items: updatedItems } }
      )

      totalItemsProcessed += topic.items.length
      results.push({
        topic: topic.topic_name,
        topLevelItems: level1Items.length,
        relationshipCount,
        totalItems: topic.items.length
      })

      console.log(`✅ Completed ${topic.topic_name}`)
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n🎉 Migration completed successfully in ${duration}s`)
    console.log(`📈 Processed ${totalItemsProcessed} items across ${topics.length} topics`)

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      stats: {
        duration: `${duration}s`,
        topicsProcessed: topics.length,
        totalItemsProcessed
      },
      results
    })
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.error(`❌ Migration failed after ${duration}s:`, error)
    
    return NextResponse.json({
      success: false,
      message: "Migration failed",
      stats: {
        duration: `${duration}s`
      },
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 