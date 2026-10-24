import { config } from "dotenv";
import { deleteTestUser } from "./test-user";

config({ path: [".env.local", ".env"], quiet: true });

export default async function globalTeardown() {
  await deleteTestUser();
}
