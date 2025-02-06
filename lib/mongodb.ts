declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined
  }
  
  import { MongoClient, Db, ClientSession } from "mongodb";
  
  if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }
  
  if (!process.env.MONGODB_DB) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_DB"');
  }
  
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB;
  let clientPromise: Promise<MongoClient>;
  
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri)
        .connect()
        .catch(error => {
          console.error("Failed to connect to the database", error);
          if (error instanceof Error) {
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
          }
          throw error;
        });
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = new MongoClient(uri)
      .connect()
      .catch(error => {
        console.error("Failed to connect to the database", error);
        if (error instanceof Error) {
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        throw error;
      });
  }
  
  export async function getDb(): Promise<Db> {
    const client = await clientPromise;
    return client.db(dbName);
  }
  
  export async function withTransaction<T>(
    operation: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    const client = await clientPromise;
    const session = client.startSession();
    
    try {
      session.startTransaction();
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
  
  export default getDb;