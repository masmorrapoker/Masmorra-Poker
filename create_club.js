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

async function executeAdminFlow(clubName, email, password) {
  console.log(`--- Iniciando Fluxo Administrativo SaaS ---`);
  
  // 1. Criar o Clube no Banco de Dados
  console.log(`1. Criando clube "${clubName}"...`);
  const { data: newClub, error: clubError } = await supabase
    .from('clubs')
    .insert({ name: clubName })
    .select()
    .single();

  if (clubError) {
    console.error('Erro ao criar clube:', clubError.message);
    return;
  }
  console.log(`Sucesso: Clube criado com ID: ${newClub.id}`);

  // 2. Criar o Usuário Operador no Auth do Supabase
  console.log(`2. Cadastrando operador "${email}"...`);
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  let userId;
  if (authError) {
    if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('existe')) {
      console.log('Operador já cadastrado no Auth. Prosseguindo com autenticação...');
    } else {
      console.error('Erro ao cadastrar operador:', authError.message);
      return;
    }
  } else {
    userId = authData.user?.id;
    console.log(`Sucesso: Novo operador criado no Auth com ID: ${userId}`);
  }

  // 2.5. Autenticar operador no script para obter o token JWT e passar pela política RLS do profile
  console.log('Autenticando operador para permitir inserção de perfil...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    console.error('Erro ao autenticar operador:', loginError.message);
    return;
  }
  userId = loginData.user?.id;
  console.log(`Sucesso: Operador autenticado com ID: ${userId}`);

  // 3. Vincular o Usuário ao Clube (Criar ou Atualizar Perfil)
  console.log(`3. Criando perfil de associação (profiles)...`);
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      club_id: newClub.id,
      role: 'operator'
    });

  if (profileError) {
    console.error('Erro ao associar perfil:', profileError.message);
    return;
  }

  console.log('----------------------------------------------------');
  console.log('NOVO CLUBE PROVISIONADO COM SUCESSO!');
  console.log(`Clube: "${newClub.name}"`);
  console.log(`Operador: ${email}`);
  console.log(`Senha: ${password}`);
  console.log('----------------------------------------------------');
  console.log('Agora você já pode entregar o e-mail e senha ao cliente!');
}

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Uso: node create_club.js "Nome do Clube" <email-operador> <senha-operador>');
  process.exit(1);
}

executeAdminFlow(args[0], args[1], args[2]);
