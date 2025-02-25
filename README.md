# Medical Topic Tree App

A Next.js application for displaying and organising hierarchical medical topics in an interactive tree structure.

## Overview

I've created this application as an interface for a non-technical person who I'm working with on a medical education platform. Users can navigate through different medical fields, view unorganised topics, and access relevant resources like PDF documents or external links to get more idea about them. 

### Tech Stack

- **Framework**: Next.js 14 with App Router (I opt out using 15 for now as it's still early phases)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn 
- **Data Fetching**: Server Components with async/await pattern
- **State Management**: zustand store. This app might not have needed a state management library but it became a habit to use from the start in every app as nearly always some sort of state management library makes my life easier down the road when expanding the codebase.

### State Management with Zustand

I chose Zustand for state management due to its simplicity, minimal boilerplate, and excellent TypeScript integration. The store implementation in `useTopicStore.ts` serves as the central hub for all topic-related operations and state.

#### Store Structure

The Zustand store manages several key state elements:

1. **Core Data State**:
   - `items`: Array of topic items currently loaded
   - `selectedTopic`: Currently selected medical field
   - `analysisData`: Hierarchical analysis data (suggestions, missing items)

2. **UI State**:
   - `isLoading` / `isSaving`: Loading indicators for async operations
   - `isEditing` / `tempEditValue`: Editing state for inline text fields
   - `lastScrollPosition`: Preserves scroll position between operations
   - `isAnalysisPanelOpen`: Controls visibility of the analysis panel

3. **Operation Functions**:
   - Data fetching (e.g., `fetchTopic`, `fetchAnalysis`)
   - CRUD operations (e.g., `addItem`, `updateItemName`, `deleteItem`)
   - Specialised operations (e.g., `moveItem`, `createRelationship`)
   - Utility functions (e.g., `checkNestedLimit`, `isItemInTree`)

#### Integration with Server Actions

The store integrates with Next.js server actions:

```typescript
// Example from useTopicStore.ts
fetchTopic: async () => {
  const { selectedTopic, lastScrollPosition } = get()
  if (!selectedTopic) return

  set({ isLoading: true })
  try {
    const data = await fetchTopicTree(selectedTopic)
    const transformedItems: TopicItem[] = data.items.map((item: any) => ({
      // Transform server data to client format
      id: item.item_id,
      // ... other transformations
    }))
    set({ items: transformedItems })
    
    // Restore scroll position
    setTimeout(() => {
      window.scrollTo({
        top: lastScrollPosition,
        behavior: 'instant'
      })
    }, 0)
  } catch (error) {
    console.error("Error fetching topics:", error)
    set({ error: error instanceof Error ? error.message : "Failed to fetch topics" })
  } finally {
    set({ isLoading: false })
  }
}
```

This pattern appears throughout the store, where server actions handle data persistence while the store manages state and UI updates.

#### Complex State Operations

The store handles several intricate operations:

1. **Hierarchical Item Management**:
   - Tree traversal algorithms to identify children and descendants
   - Maintaining proper order indices for visual sorting
   - Ensuring referential integrity when moving or deleting items

2. **Validation Logic**:
   - Enforcing limits on nested items (maximum 10 per parent)
   - Preventing circular references when moving items
   - Validating relationship constraints

3. **Optimistic Updates with Rollback**:
   - Some operations update the local state immediately for UI responsiveness
   - If server operations fail, the state is reverted
   - Error handling propagates meaningful messages to the user

4. **State Synchronization**:
   - Scroll position preservation between operations
   - Proper state handling during asynchronous operations

#### Benefits of the Zustand Approach

This implementation provides several advantages:

1. **Centralised Logic**: All topic-related operations are contained in a single file, making the codebase more maintainable.

2. **Separation of Concerns**: UI components focus on rendering while the store handles data and logic.

3. **Type Safety**: Comprehensive TypeScript interfaces ensure type safety across the application.

4. **Testing Simplicity**: Store functions can be tested independently of UI components althouh I haven't implemented here due to its simplicity.

5. **Performance**: Zustand's minimal re-rendering approach keeps the application responsive even with complex operations.

### Key Components

- **TopicTree**: This is the main component responsible for rendering and managing the topic hierarchy
- **URL-based State**: Preserves user navigation state in the URL for shareability and browser history support

## Data Flow

1. **Initial Load**:
   - The app checks URL search parameters for a selected topic
   - If a valid topic is found, data is fetched server-side using `fetchTopicTree`
   - If there is no field parameter user will see a field selection screen
   - Data is transformed to a standardised format and passed to client components

2. **Navigation**:
   - User interactions update the URL search parameters
   - URL changes trigger refetching of relevant data
   - The UI updates to reflect the current topic selection

## Implementation Details

### Server-Side Data Fetching

I try to follow Next.js best practices by using Server Components for data fetching. In `app/page.tsx` :

1. We extract the topic from search parameters
2. Then validate it against allowed topics
3. Then fetch data directly on the server using `fetchTopicTree`
4. Transform the data to our internal format including serialising mongodb objectsId and date
5. Pass the prepared data to client components

### URL-based State Management

I use URL search parameters to maintain application state at the most basic level:

```typescript
// Example from app/page.tsx
if (searchParams.topic && MEDICAL_TOPICS.includes(searchParams.topic as any)) {
  initialTopic = searchParams.topic
  initialItems = await getInitialTopicData(searchParams.topic)
}
```

Benefits of this approach:
- **Shareable URLs**: Users can share exact application states via URL
- **Browser History**: Navigation works naturally with browser back/forward buttons
- **Bookmarkable States**: Users can bookmark specific topics
- **No Hydration Issues**: Avoids common hydration mismatches in Next.js as I'm wrapping the component in Suspense

### Data Operations: Read and Write

The application has a clear separation between server and client data models, with careful type transformations between them. This ensures type safety and accommodates different needs of server and client environments.

#### Data Models

We maintain two parallel data models:
- **Server-side models**: Use MongoDB's `ObjectId` for database operations
- **Client-side models**: Use string representations of IDs for serialization and client-side manipulation

```typescript
// Server-side interface example
export interface TopicTree {
  topic_name: string
  items: {
    item_id: ObjectId;  // MongoDB ObjectId for server use
    // Other fields...
  }[]
}

// Client-side interface example
export interface TopicItem {
  id: string;  // String representation for client use
  // Other fields...
}
```

#### Read Operations

1. **Data Fetching**:
   - Server actions fetch data from MongoDB using the `"use server"` directive
   - `fetchTopicTree` retrieves topic hierarchies based on the selected medical field
   - Data is fetched directly on the server, keeping API keys and database credentials secure

2. **Data Transformation**:
   - MongoDB `ObjectId`s are converted to strings for client consumption
   - Date objects are serialised to ISO strings
   - The transformed data maintains relationships between items while being JSON-serializable

3. **Data Delivery**:
   - The server component passes the prepared data to client components
   - This happens during server-side rendering, reducing client-side JavaScript

#### Write Operations

1. **Server Actions**:
   - All write operations are implemented as server actions with `"use server"` directive
   - This provides secure, direct database access without exposing endpoints

2. **Type Safety**:
   - The application uses TypeScript interfaces to ensure type safety across operations
   - `ActionResponse` interface provides consistent response structure:
     ```typescript
     export interface ActionResponse {
       success: boolean
       message: string
       error?: string
       item?: any
     }
     ```

3. **Hierarchy Modifications**:
   - Operations like `moveItemUp` allow reorganizing topic hierarchies
   - Relationship management enables connecting related topics
   - All operations validate input data before processing

4. **Data Consistency**:
   - Write operations update both the database and return updated data
   - Client state is updated via revalidation rather than optimistic updates
   - This approach prevents data inconsistencies while maintaining responsiveness

#### Write Operations

##### Reindexing Operations

I've implemented a sophisticated reindexing system to maintain correct order of topics within the hierarchy. This might be a bit of stretch to do with typescript but it works fine:

1. **Order Index Management**:
   - Each topic item has an `order_index` property that defines its position within its parent
   - When items are reordered, the application recalculates order indices for affected items
   - This ensures consistent visualization regardless of when items were created

2. **Batch Reindexing**:
   - When multiple items need reordering, we perform batch updates
   - This reduces database operations and ensures atomic updates
   - Example: When moving an item up in the hierarchy, all siblings between the source and target positions are reindexed

3. **Index Normalization**:
   - Periodically, the application normalises indices (e.g., converting 1, 3, 7 to 1, 2, 3)
   - This prevents index fragmentation and maintains optimal performance for sorting operations

##### Moving and Deleting Topics

We also handle structural modifications to the topic hierarchy with careful consideration for data integrity:

1. **Moving Topics**:
   - Topics can be moved within the hierarchy (changing parent)
   - This operation updates:
     - The parent reference
     - Order indices of items in both the source and target parent
     - Any relationships that may be affected
   - A tree-walking algorithm ensures child items move with their parent

2. **Deleting Topics**:
   - Topic deletion can be performed at any level of the hierarchy
   -It supports both:
     - Simple deletion (remove just the selected item)
     - Cascading deletion (remove the item and all its children)
   - Orphaned relationships are either removed or redirected based on configuration

3. **Reference Integrity**:
   - When topics are moved or deleted, the application maintains referential integrity
   - This prevents dangling references or orphaned items
   - Relationship data is updated to reflect the new structure

##### Database Transactions

MongoDB transactions are a critical feature I use in all my apps when needed.

1. **Why I Love Transactions?**:
   - **Atomic Operations**: All changes succeed or fail together, preventing partial updates
   - **Data Integrity**: Ensures the database remains in a consistent state even during complex operations
   - **Rollback Capability**: If any part of an operation fails, all changes are reverted automatically

2. **Transaction Implementation**:
   - The application uses MongoDB's session-based transaction API
   - Each complex operation (reindexing, moving, relationships) is wrapped in a transaction
   - Error handling includes appropriate rollback mechanics and client notification

3. **Transaction Boundaries**:
   - Transactions are carefully scoped to include all related operations
   - For performance reasons, read operations are kept outside transaction boundaries when possible
   - Example transaction pattern:
     ```typescript
     const session = client.startSession();
     session.startTransaction();
     try {
       // Perform multiple write operations...
       await session.commitTransaction();
       return { success: true, message: "Operation completed successfully" };
     } catch (error) {
       await session.abortTransaction();
       return { success: false, error: error.message };
     } finally {
       session.endSession();
     }
     ```

4. **Performance Considerations**:
   - Transactions add some overhead, so they're used on needs basis
   - For single-document updates, direct operations are preferred as it's already atomic inherently
   - For multi-document consistency (like reindexing), the transaction benefit outweighs the performance cost


## Key Features

- **Dynamic Topic Loading**: Loads topic data on demand
- **Hierarchical Visualization**: Displays topic relationships in an intuitive tree structure
- **State Persistence**: Maintains user navigation state via URL
- **Responsive Design**: Works across device sises
- **Performance Optimised**: Leverages Next.js server components for optimal loading

## Dependency Choices

### Core Framework and Language
- **Next.js 14**: Generally main choice for react apps. especially considering they removed create react app functionality alltogether its a default and easity way
- **TypeScript**: 
- **React 18**: 

### State Management and Data Handling
- **Zustand**: my main go to choice for state management, lightweight
- **MongoDB**: I've used MongoDB since I've started coding due to Mongo's startup credits
- **React DnD**: Provides drag-and-drop capabilities essential for the interactive reorganization of topic hierarchies

### UI Components and Styling
- **Tailwind CSS**: 
- **shadcn/ui**: main and customasible UI choice

### Form Handling and Validation  - following dependencies can be removed, they are just from my boilerplate as they save so much time 
- **React Hook Form**: 
- **Zod**: 
- **@hookform/resolvers**:

### Utilities and Enhancements
- **date-fns**: 
- **lucide-react**: 
- **next-themes**: 
- **tailwind-merge**: 
- **tailwindcss-animate**: 

### Performance and User Experience
- **sonner**:  customizable toast notifications with minimal footprint by emil 
- **react-resizable-panels**: resizable panels in the UI for better workspace customization
- **embla-carousel-react**: carousel component for topic visualization options


## Getting Started

### Prerequisites

- Node.js 18.17.0 or later
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/medical-topic-tree.git
cd medical-topic-tree
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

The application currently deployed in Vercel medical-topic-tree.vercel.app

## No test coverage

Due to use case and simplicity I didn't spend time on writing tests but I'll opt in for playwrigth if I've done it as it can be challenging to test with jest in next.js 