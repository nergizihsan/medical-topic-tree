import { Suspense } from "react"
import TopicTree from "@/components/TopicTree"
import { MEDICAL_TOPICS } from "@/lib/constants"
import { fetchTopicTree } from "@/app/actions/topics"
import type { TopicItem } from "@/types/topic"

interface Props {
  searchParams: { topic?: string }
}

async function getInitialTopicData(topic: string) {
  try {
    const data = await fetchTopicTree(topic)
    return data.items.map((item: any) => ({
      id: item.item_id,
      item_name: item.item_name,
      item_level: item.item_level,
      parent_element_id: item.parent_item_id,
    }))
  } catch (error) {
    console.error("Error fetching initial topic:", error)
    return null
  }
}

export default async function Home({ searchParams }: Props) {
  let initialTopic = ""
  let initialItems: TopicItem[] | null = null

  // Only fetch if we have a valid topic in URL
  if (searchParams.topic && MEDICAL_TOPICS.includes(searchParams.topic as any)) {
    initialTopic = searchParams.topic
    initialItems = await getInitialTopicData(searchParams.topic)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-medical-dark" />
        </div>
      }>
        <TopicTree 
          initialTopic={initialTopic} 
          initialItems={initialItems} 
        />
      </Suspense>
    </div>
  )
}

