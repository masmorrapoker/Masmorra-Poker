import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Load .env configuration
let env = {};
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
} catch (e) {
  console.error('Erro ao ler arquivo .env:', e.message);
  process.exit(1);
}

const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function createUser(email, password) {
  console.log(`Cadastrando usuário ${email} no Supabase...`);
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Erro ao criar usuário:', error.message);
  } else {
    console.log('----------------------------------------------------');
    console.log('Usuário criado com sucesso!');
    console.log(`E-mail: ${data.user?.email}`);
    console.log('Status do Usuário:', data.user?.identities?.length ? 'Confirmado' : 'Aguardando confirmação de e-mail (se habilitado no Supabase)');
    console.log('----------------------------------------------------');
    console.log('Agora você já pode utilizar estas credenciais para logar na tela de acesso!');
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Uso: node create_user.js <seu-email> <sua-senha>');
  process.exit(1);
}

createUser(args[0], args[1]);
