"""Conta de DEMONSTRAÇÃO na API local (dados inventados): prints da Play e login pros revisores.

Marina Alves (demo@myfinance.app.br) com a carteira "Casa", compartilhada com Lucas Alves, e a carteira "Viagem 2027".
As datas são fixas (novembro de 2026): rodando em outro mês, ajuste as datas das transações e recorrências.

Uso: DEMO_PASSWORD=... python seed_demo.py [URL da API, ex. http://localhost:3010/v1] [X-API-Key]
Variáveis opcionais: MAIN_TOKEN (popular uma conta que já existe, ex. a do revisor da Play, em vez de criar a
Marina) e LUCAS_EMAIL (e-mail do segundo membro).
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:3010/v1'
KEY = sys.argv[2] if len(sys.argv) > 2 else 'local-dev-token'
PASSWORD = os.environ.get('DEMO_PASSWORD')
if not PASSWORD:
    raise SystemExit('Defina DEMO_PASSWORD (a senha das contas de demonstração; não fica no repositório).')
T = '-03:00'


def call(method, path, body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header('X-API-Key', KEY)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read() or b'{}')
    except urllib.error.HTTPError as error:
        raise SystemExit(f'{method} {path} -> {error.code}: {error.read()[:300]!r}\nbody={body}')


def user(name, email):
    try:
        call('POST', '/auth/sign_up', {'name': name, 'email': email, 'password': PASSWORD})
    except SystemExit as error:
        if '422' not in str(error):
            raise
        print(f'{email} já existia')
    return call('POST', '/auth/sign_in', {'email': email, 'password': PASSWORD})['data']['token']


# MAIN_TOKEN = popular uma conta que já existe (a do revisor da Play) em vez de criar a da Marina.
marina = os.environ.get('MAIN_TOKEN') or user('Marina Alves', 'demo@myfinance.app.br')
LUCAS_EMAIL = os.environ.get('LUCAS_EMAIL', 'lucas.demo@myfinance.app.br')
lucas = user('Lucas Alves', LUCAS_EMAIL)

main = call('GET', '/wallets/main', token=marina)
main = main.get('data', main)
call('PATCH', f"/wallets/{main['id']}", {'wallet': {'name': 'Casa'}}, marina)
casa = main['id']
viagem = call('POST', '/wallets', {'wallet': {'name': 'Viagem 2027'}}, marina)['data']['id']


def account(wallet, name, initial, token=marina):
    return call('POST', '/accounts', {'wallet_id': wallet, 'account': {'name': name, 'kind': 'checking', 'initial_balance': initial}}, token)['data']['id']


def credit(wallet, name, limit, best, due, digits):
    cid = call('POST', '/credit_balances', {'wallet_id': wallet, 'credit_balance': {'name': name, 'credit_limit': limit, 'best_purchase_day': best, 'due_day': due}}, marina)['data']['id']
    card = call('POST', '/credit_cards', {'credit_balance_id': cid, 'credit_card': {'name': 'PRINCIPAL', 'last_digits': digits}}, marina)['data']['id']
    return cid, card


nubank = account(casa, 'Nubank', 380000)
itau = account(casa, 'Itaú', 1280000)
caixinha = account(viagem, 'Caixinha da viagem', 350000)
cc_nubank, card_nubank = credit(casa, 'Nubank', 800000, 3, 10, '4821')
cc_inter, card_inter = credit(casa, 'Inter', 500000, 28, 5, '7730')


# Lucas entra na "Casa".
call('POST', '/user_wallets', {'user_wallet': {'user_email': LUCAS_EMAIL, 'wallet_id': casa}}, marina)
for invite in call('GET', '/user_wallets', token=lucas)['data']:
    call('POST', f"/user_wallets/{invite['id']}/accept", token=lucas)
call('PATCH', '/users/me', {'user': {'main_wallet_id': casa}}, lucas)


def tx(description, value, kind, date, source, settled=False, token=marina, credit_card=None, destination=None):
    body = {'description': description, 'value': value, 'kind': kind, 'transaction_date': f'{date}T{"12:00:00"}{T}'}
    if credit_card:
        body.update({'source_type': 'CreditBalance', 'source_id': source, 'credit_card_id': credit_card})
    else:
        body.update({'source_type': 'Account', 'source_id': source})
        if settled:
            body['settled_date'] = body['transaction_date']
    if destination:
        body['destination_account_id'] = destination
    call('POST', '/transactions', {'transaction': body}, token)


# Contas, novembro.
tx('Salário', 785000, 'deposit', '2026-11-05', nubank, settled=True)
tx('Salário', 620000, 'deposit', '2026-11-05', itau, settled=True, token=lucas)
tx('Aluguel', 240000, 'withdraw', '2026-11-06', nubank, settled=True)
tx('Condomínio', 68000, 'withdraw', '2026-11-08', nubank, settled=True)
tx('Conta de luz', 21470, 'withdraw', '2026-11-12', itau, settled=True, token=lucas)
tx('Internet', 11990, 'withdraw', '2026-11-15', nubank, settled=True)
tx('Feira do sábado', 18640, 'withdraw', '2026-11-22', itau, settled=True, token=lucas)
tx('Reserva do mês', 100000, 'transfer', '2026-11-20', nubank, settled=True, destination=itau)
tx('Plano de saúde', 89000, 'withdraw', '2026-11-26', nubank)
tx('Escola de inglês', 45000, 'withdraw', '2026-11-28', itau, token=lucas)
tx('Freela de design', 120000, 'deposit', '2026-11-30', nubank)

# Cartões: compras de outubro (fatura do Nubank que venceu em 10/11) e de novembro.
for description, value, date in [('Mercado Pão de Açúcar', 38790, '2026-10-06'), ('Posto Shell', 21000, '2026-10-14'),
                                 ('iFood', 6890, '2026-10-19'), ('Farmácia São Paulo', 5420, '2026-10-27')]:
    tx(description, value, 'withdraw', date, cc_nubank, credit_card=card_nubank)
for description, value, date, cc, card in [
    ('Mercado Pão de Açúcar', 41235, '2026-11-04', cc_nubank, card_nubank), ('iFood', 7890, '2026-11-09', cc_nubank, card_nubank),
    ('Uber', 3250, '2026-11-14', cc_inter, card_inter), ('Farmácia São Paulo', 6420, '2026-11-16', cc_nubank, card_nubank),
    ('Posto Shell', 22000, '2026-11-19', cc_inter, card_inter), ('Restaurante Mocotó', 18600, '2026-11-21', cc_inter, card_inter),
    ('Amazon', 14990, '2026-11-22', cc_inter, card_inter),
]:
    tx(description, value, 'withdraw', date, cc, credit_card=card)


def recurrence(kind, rtype, description, start, source_type, source, value=None, total=None, count=None, card=None):
    body = {'recurrence_type': rtype, 'kind': kind, 'description': description, 'frequency': 'monthly', 'interval': 1,
            'start_date': start, 'source_type': source_type, 'source_id': source}
    if value:
        body['value'] = value
    if total:
        body['total_value'] = total
    if count:
        body['occurrences_total'] = count
    if card:
        body['credit_card_id'] = card
    call('POST', '/recurrences', {'recurrence': body}, marina)


# Recorrências daqui pra frente (geram as previstas da projeção) e parcelas.
recurrence('deposit', 'recurring', 'Salário', '2026-12-05', 'Account', nubank, value=785000)
recurrence('withdraw', 'recurring', 'Aluguel', '2026-12-06', 'Account', nubank, value=240000)
recurrence('withdraw', 'recurring', 'Condomínio', '2026-12-08', 'Account', nubank, value=68000)
recurrence('withdraw', 'recurring', 'Academia', '2026-12-01', 'Account', itau, value=12990)
recurrence('withdraw', 'recurring', 'Netflix', '2026-11-12', 'CreditBalance', cc_nubank, value=5590, card=card_nubank)
recurrence('withdraw', 'recurring', 'Spotify Família', '2026-11-18', 'CreditBalance', cc_inter, value=3490, card=card_inter)
recurrence('withdraw', 'installment', 'Notebook', '2026-09-15', 'CreditBalance', cc_nubank, total=479900, count=10, card=card_nubank)
recurrence('withdraw', 'installment', 'Geladeira', '2026-10-02', 'CreditBalance', cc_inter, total=320000, count=6, card=card_inter)

# Faturas já vencidas, pagas (a de outubro do Nubank tem a 2ª parcela do notebook).
for cc, account_id, ref, day in [(cc_nubank, nubank, '2026-10', '2026-10-10'), (cc_nubank, nubank, '2026-11', '2026-11-10'), (cc_inter, itau, '2026-11', '2026-11-05')]:
    call('POST', f'/credit_balances/{cc}/pay_invoice', {'account_id': account_id, 'reference': ref, 'settled_date': f'{day}T09:00:00{T}'}, marina)

# Viagem: um aporte e uma reserva.
tx('Aporte do mês', 50000, 'deposit', '2026-11-10', caixinha, settled=True)
tx('Passagens Lisboa (sinal)', 120000, 'withdraw', '2026-12-15', caixinha)

for a in call('GET', f'/accounts?wallet_id={casa}', token=marina)['data']:
    print(f"  {a['name']}: {a['balance'] / 100:.2f}")
print('ok')
