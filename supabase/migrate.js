// data/*.json의 500문제를 Supabase questions 테이블로 옮긴다.
// 실행 전: supabase/schema.sql을 Supabase SQL Editor에서 먼저 실행하고,
//          .env에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 채워둘 것.
// 실행: node supabase/migrate.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다. .env.example을 참고해 .env를 채워주세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CATEGORY_FILES = {
  general: '일반상식',
  geography: '지리',
  history: '한국사',
  iq: '인지능력',
  science: '과학',
};

async function main() {
  let totalUpserted = 0;

  for (const [categoryId, label] of Object.entries(CATEGORY_FILES)) {
    const filePath = path.join(__dirname, '..', 'data', `${categoryId}.json`);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    const rows = raw.map((q) => ({
      id: q.id,
      category_id: categoryId,
      level: q.level,
      question: q.question,
      options: q.options,
      answer: q.answer,
      source: q.source ?? null,
    }));

    const { error, count } = await supabase
      .from('questions')
      .upsert(rows, { onConflict: 'id', count: 'exact' });

    if (error) {
      console.error(`  실패: ${label} (${categoryId}) →`, error.message);
      process.exitCode = 1;
      continue;
    }

    console.log(`  완료: ${label} (${categoryId}) — ${rows.length}문제 upsert`);
    totalUpserted += rows.length;
  }

  const { count: finalCount, error: countError } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('최종 카운트 확인 실패:', countError.message);
    return;
  }

  console.log(`\n마이그레이션 완료. 이번 실행 upsert: ${totalUpserted}건 / questions 테이블 총 행 수: ${finalCount}건`);
}

main();
