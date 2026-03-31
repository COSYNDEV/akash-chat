import { NextRequest, NextResponse } from 'next/server';

import { getOptionalSession, isAuth0Configured } from '@/lib/auth';
import { deleteAllUserData } from '@/lib/database';

export async function DELETE(req: NextRequest) {
  try {
    if (!isAuth0Configured()) {
      return NextResponse.json({ error: 'Authentication not configured' }, { status: 401 });
    }

    const session = await getOptionalSession(req);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const issuerBaseUrl = process.env.AUTH0_ISSUER_BASE_URL;
    if (!issuerBaseUrl) {
      return NextResponse.json({ error: 'Missing AUTH0_ISSUER_BASE_URL' }, { status: 500 });
    }

    // Delete all user data from application database
    await deleteAllUserData(userId);

    return NextResponse.json({ 
      success: true, 
      message: 'Account deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete account' },
      { status: 500 }
    );
  }
}