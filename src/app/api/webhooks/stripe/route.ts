/**
 * Stripe Webhook API Route
 * Handles incoming Stripe webhook events with proper security and error handling
 * Production-ready implementation with comprehensive logging and idempotency
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/client';
import { processWebhookEvent } from '@/lib/stripe/webhook-handlers';
import { db } from '@/lib/db';

/**
 * POST handler for Stripe webhooks
 * Verifies webhook signature and processes events idempotently
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature');
  
  if (!sig) {
    console.error('Missing Stripe signature header');
    return NextResponse.json(
      { error: 'Missing signature header' },
      { status: 400 }
    );
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // Check for duplicate events (idempotency)
  try {
    const existingEvent = await db.webhookEvent.findUnique({
      where: { stripeEventId: event.id }
    });

    if (existingEvent && existingEvent.processed) {
      console.log(`Duplicate webhook event ignored: ${event.id}`);
      return NextResponse.json({ received: true });
    }

    // Process the webhook event
    await processWebhookEvent(event);

    // Mark event as processed
    await db.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: { 
        processed: true,
        processedAt: new Date(),
        attempts: { increment: 1 }
      },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: true,
        processedAt: new Date(),
        attempts: 1,
        eventData: event.data.object as any
      }
    });

    console.log(`Successfully processed webhook: ${event.type} (${event.id})`);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook processing failed:', error);

    // Log failed processing attempt
    await db.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      update: { 
        error: error.message,
        attempts: { increment: 1 },
        lastAttemptAt: new Date()
      },
      create: {
        stripeEventId: event.id,
        eventType: event.type,
        processed: false,
        error: error.message,
        attempts: 1,
        lastAttemptAt: new Date(),
        eventData: event.data.object as any
      }
    });

    // Return 500 to trigger Stripe retry
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for webhook endpoint verification
 * Useful for testing and health checks
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    message: 'Stripe webhook endpoint is active',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
}