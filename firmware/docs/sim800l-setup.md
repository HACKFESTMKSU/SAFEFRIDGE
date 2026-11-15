# SIM800L GSM module — AT bring-up cheat sheet

Goal: get the SIM800L registered on the cellular network and able to send
SMS, independent of the ESP32 firmware (use any USB-TTL adapter or the
ESP32 `Serial2` monitor first).

## 1. Hardware checklist

- [ ] **Antenna attached** — mandatory before transmit tests.
- [ ] **SIM inserted** — unlocked, SMS-enabled, with credit.
- [ ] **Power: external 3.7–4.2 V, ≥ 2 A** (LiPo 18650/21700 or dedicated
      buck). **Never the ESP32 3.3 V pin.**
- [ ] ~1000 µF electrolytic across SIM800L VCC/GND, close to the module.
- [ ] Short, thick power wires; common GND with the ESP32.
- [ ] Logic level: most boards are 2.8 V. ESP32 3.3 V TX → SIM800L RXD
      usually works; add a divider (e.g. 10k/20k) if the module misbehaves.
      SIM800L TXD → ESP32 RXD (GPIO16) is fine directly.
- [ ] UART wiring: ESP32 GPIO17 (TX2) → SIM800L **RXD**; ESP32 GPIO16 (RX2)
      ← SIM800L **TXD**. Baud commonly **9600** (some boards 115200).

## 2. AT command sequence

Send each command, expect `OK` (module default echo is ON — you will see
your command echoed; `ATE0` disables it).

| Step | Command | Expect / meaning |
| --- | --- | --- |
| Handshake | `AT` | `OK` — module alive |
| Echo off | `ATE0` | `OK` |
| SMS text mode | `AT+CMGF=1` | `OK` — required for readable SMS |
| GSM alphabet | `AT+CSCS="GSM"` | `OK` — 7-bit default charset |
| Signal quality | `AT+CSQ` | `+CSQ: <rssi>,<ber>` — RSSI 0–31; **≥ 10 usable**, ≥ 20 good |
| Network reg | `AT+CREG?` | `+CREG: 0,1` (home) or `0,5` (roaming) = registered; `0,0`/`0,2` = not yet |
| Operator (opt) | `AT+COPS?` | shows registered network |
| Module info | `ATI` / `AT+GMI` / `AT+GMM` / `AT+GMR` | vendor/model/firmware rev |
| IMEI | `AT+CGSN` | module identity |
| Set baud (opt) | `AT+IPR=9600` then `AT&W` | persists; **must match `SIM800L_BAUD` in config.h** |
| SMS notify (opt) | `AT+CNMI=2,1,0,0,0` | surface incoming SMS as `+CMTI` |

If `AT+CREG?` stays `0,0`/`0,2` for minutes: check antenna, SIM seating,
APN not needed for SMS, and try `AT+CFUN=1,1` (full reset) or power-cycle.

## 3. Send a test SMS

```
AT+CMGS="+2547XXXXXXXX"      <-- your number, international format
>                              <-- module prompts with '>'
ColdGuard test 123            <-- message body
<Ctrl-Z>                       <-- 0x1A terminates and sends
+CMGS: <mr>                    <-- message reference = success
OK
```

Notes:

- Wait for the `>` prompt before typing the body.
- Body is terminated by **Ctrl-Z (0x1A)**, not Enter. Many terminals send
  it via `Ctrl+Z` or `SendHex 1A`.
- `+CMS ERROR: <n>` on failure — common causes: no signal (`AT+CSQ`),
  not registered (`AT+CREG?`), bad number format, or SMS center not
  provisioned on the SIM.
- Keep the message under ~160 chars for a single SMS segment.

## 4. Receive a test SMS (optional)

With `AT+CNMI=2,1,0,0,0` set, incoming SMS arrives as:

```
+CMTI: "SM", <index>
AT+CMGR=<index>               <-- read it
+CMGR: ... "ColdGuard test..."
OK
AT+CMGD=1,4                   <-- delete all stored SMS (housekeeping)
```

## 5. ColdGuard firmware mapping

| Firmware piece | AT equivalent |
| --- | --- |
| `simInit()` | `AT`, `ATE0`, `AT+CMGF=1`, `AT+CSCS="GSM"`, `AT+CNMI=2,1,0,0,0`, `AT+CSQ`, `AT+CREG?` |
| `simSendSms()` | `AT+CMGS="<num>"` → `>` → body → `0x1A` → wait `OK` |
| `SMS_RECIPIENTS` | comma-separated numbers, broadcast loop |
| `SIM_SMS_COOLDOWN_MS` | FR-14b rate limit (15 min per alert kind) |

If the module answers `AT` but not at 9600, try 115200 — and update
`SIM800L_BAUD` in `src/config.h` to match.
