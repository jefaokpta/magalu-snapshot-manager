'use strict';

const { listSnapshots, deleteSnapshot } = require('./magalu-api');

const RETENCAO_DIAS = 7;
const PREFIXO = 'auto-';
const DIA_MS = 24 * 60 * 60 * 1000;

function ehAntigo(createdAt) {
  const criado = new Date(createdAt).getTime();
  if (Number.isNaN(criado)) return false;
  return Date.now() - criado > RETENCAO_DIAS * DIA_MS;
}

async function main() {
  console.log('Listando snapshots...');
  const snaps = await listSnapshots();
  console.log(`Encontrados ${snaps.length} snapshot(s).`);

  const paraApagar = snaps.filter(
    (s) => typeof s.name === 'string' && s.name.startsWith(PREFIXO) && ehAntigo(s.created_at)
  );
  console.log(
    `${paraApagar.length} snapshot(s) elegíveis para deleção ` +
      `(prefixo "${PREFIXO}" com mais de ${RETENCAO_DIAS} dias).`
  );

  let apagados = 0;
  let falhas = 0;

  for (const s of paraApagar) {
    try {
      await deleteSnapshot(s.id);
      console.log(`[ok] apagado "${s.name}" (${s.id}) criado em ${s.created_at}`);
      apagados++;
    } catch (err) {
      console.error(`[falha] "${s.name}" (${s.id}): ${err.message}`);
      falhas++;
    }
  }

  console.log(`\nResumo: ${apagados} apagados, ${falhas} falhas.`);
  if (falhas > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exitCode = 1;
});