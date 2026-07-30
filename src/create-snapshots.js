'use strict';

const { listInstances, createSnapshot } = require('./magalu-api');

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function snapshotName(vmName) {
  const safe = (vmName || 'vm').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 230);
  return `auto-${safe}-${stamp()}`;
}

async function main() {
  console.log('Listando VMs...');
  const vms = await listInstances();
  console.log(`Encontradas ${vms.length} VM(s).`);

  let criados = 0;
  let pulados = 0;
  let falhas = 0;

  for (const vm of vms) {
    const name = snapshotName(vm.name);
    try {
      const res = await createSnapshot(vm.id, name);
      console.log(`[ok] snapshot solicitado para "${vm.name}" (${vm.id}) -> ${res && res.id ? res.id : name}`);
      criados++;
    } catch (err) {
      if (err.status === 409) {
        console.log(`[skip] snapshot já existe para "${vm.name}" -> ${name}`);
        pulados++;
      } else {
        console.error(`[falha] "${vm.name}" (${vm.id}): ${err.message}`);
        falhas++;
      }
    }
  }

  console.log(`\nResumo: ${criados} criados, ${pulados} pulados, ${falhas} falhas.`);
  if (falhas > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Erro fatal:', err.message);
  process.exitCode = 1;
});