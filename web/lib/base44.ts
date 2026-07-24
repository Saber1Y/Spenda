"use client";

import {createClient, type Base44Client} from "@base44/sdk";

let client: Base44Client | null = null;

export function getBase44Client(): Base44Client {
  if (client) return client;
  client = createClient({appId: process.env.NEXT_PUBLIC_BASE44_APP_ID!});
  return client;
}
