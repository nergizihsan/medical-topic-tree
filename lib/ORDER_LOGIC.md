# Topic Tree Ordering Logic

## Overview

The topic tree uses a hierarchical ordering system based on item levels and relationships. The ordering is managed through the `order_index` field, which combines level information with sequential ordering.

## Order Index Structure

### Level 1 Items (Top Level)

- Base indexes: 1000, 2000, 3000, etc.
- Reserved range: 1000-99999
- Relationships are prioritized, keeping related items together
- Within relationship groups, items are sorted alphabetically
- Remaining items are sorted alphabetically

### Level 2 Items

- Base index: 200
- Increment: 10 (210, 220, 230, etc.)
- Reserved range: 200-299
- Sorted by:
  1. Parent's order_index
  2. Alphabetically within siblings

### Level 3 Items

- Base index: 300
- Increment: 10 (310, 320, 330, etc.)
- Reserved range: 300-399
- Sorted by:
  1. Parent's order_index
  2. Alphabetically within siblings

### Higher Levels

- Pattern continues: Level N starts at N00
- Increment: 10
- Reserved range: N00-N99

## Ordering Rules

1. **Level-Based Separation**

   - Each level has its own number range
   - No overlap between levels
   - Easy visual identification of item's level

2. **Sibling Ordering**

   - Items at the same level with same parent are siblings
   - Siblings are ordered by increments of 10
   - Allows for future insertions between items

3. **Relationship Priority**

   - Only applies to Level 1 items
   - Related items are kept together in the ordering
   - Alphabetical sorting within relationship groups

4. **Parent-Child Relationship**
   - Children are sorted under their parent
   - Parent's order affects child ordering
   - Siblings maintain their relative order

## Example

    typescript

// Level 1 items (top level)
{
item_name: "Cardiology",
item_level: 1,
order_index: 1000
}
{
item_name: "Related to Cardiology", // Has relationship
item_level: 1,
order_index: 2000
}
// Level 2 items (under Cardiology)
{
item_name: "Heart Disease",
item_level: 2,
parent_item_id: "cardiology_id",
order_index: 210
}
{
item_name: "Arrhythmia",
item_level: 2,
parent_item_id: "cardiology_id",
order_index: 220
}
// Level 3 items (under Heart Disease)
{
item_name: "Treatment",
item_level: 3,
parent_item_id: "heart_disease_id",
order_index: 310
}

```

## Functions and Ordering

1. **addTopicItem**
   - Calculates new order_index based on siblings
   - Uses level * 100 as base
   - Adds 10 to highest sibling order_index

2. **reorderAfterRelationship**
   - Only reorders items at same level
   - Maintains relationship proximity
   - Recalculates order_index for affected items

3. **changeItemSubject**
   - Recalculates order_index in new topic
   - Maintains hierarchy in both source and target

## Best Practices

1. Always use increments of 10 to allow for future insertions
2. Keep level-based ranges separate
3. Maintain relationship grouping for level 1 items
4. Sort alphabetically when no other ordering rules apply
5. Preserve parent-child relationships in ordering

## Notes

- Order_index is unique within each topic tree
- Allows for up to 90 items per level (more if needed)
- Easy to visually debug with level-based numbering
- Flexible for future additions and reordering
```
