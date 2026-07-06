import { NextRequest, NextResponse } from 'next/server';
import { getMasterRows } from '@/lib/owner-sheets';
import { getAllIdUploads } from '@/lib/id-upload';
import { getAllDonationSummary } from '@/lib/donation';

export async function GET(req: NextRequest) {
  const dong = req.nextUrl.searchParams.get('dong'); // "901" or null

  try {
    const [{ rows, surveyIds }, idUploads, donationSummary] = await Promise.all([
      getMasterRows(),
      getAllIdUploads().catch(() => []),
      getAllDonationSummary().catch(() => new Map<string, { total: number; count: number }>()),
    ]);

    // 세대별 신분증 업로드 장수 (파기 제외)
    const idCount = new Map<string, number>();
    for (const u of idUploads) {
      const key = `${u.dong}-${u.ho}`;
      idCount.set(key, (idCount.get(key) || 0) + 1);
    }

    const withId = rows.map((r) => {
      const key = `${r.dong}-${r.ho}`;
      const donation = donationSummary.get(key);
      return {
        ...r,
        idUploaded: idCount.get(key) || 0,
        donationTotal: donation?.total ?? 0,
        donationCount: donation?.count ?? 0,
      };
    });

    const filtered = dong ? withId.filter((r) => r.dong === dong) : withId;
    return NextResponse.json({ rows: filtered, surveyIds });
  } catch (e) {
    // 항상 유효한 JSON을 반환해 클라이언트의 "Unexpected end of JSON input" 크래시 방지
    const message = e instanceof Error ? e.message : String(e);
    console.error('[api/unified] GET 오류:', e);
    return NextResponse.json({ rows: [], surveyIds: [], error: message }, { status: 500 });
  }
}
