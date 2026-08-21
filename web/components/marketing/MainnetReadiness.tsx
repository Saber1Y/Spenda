import {Section} from "./Section";

const usdt = "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C";

export function MainnetReadiness() {
  return <Section tone="dark" id="mainnet"><div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end"><div><h2 className="max-w-[20ch] font-heading text-heading leading-tight text-obsidian sm:text-heading-lg sm:leading-[1.1]" style={{fontWeight: 380}}>Built for USDT settlement on BOT Chain mainnet.</h2><p className="mt-5 max-w-[60ch] text-body text-fog">BOT funds gas and the paymaster. Official bridged USDT stays inside the policy vault. Restricted agents never custody either asset.</p></div><div className="border-l-2 border-base-orange pl-5"><p className="text-caption text-fog">Deployment status</p><p className="mt-1 text-[18px] font-medium text-obsidian">Testnet proven. Mainnet gas grant pending.</p></div></div><div className="mt-12 grid gap-px overflow-hidden border border-ash bg-ash md:grid-cols-3"><AssetFact label="Spend asset" value="USDT · 6 decimals" detail={usdt} /><AssetFact label="Gas asset" value="BOT" detail="Owner wallet + paymaster deposit" /><AssetFact label="Mainnet network" value="Chain ID 677" detail="rpc.botchain.ai" /></div><p className="mt-5 max-w-[76ch] text-caption text-fog">Current live proof below uses testnet mUSD, a valueless mock token with the same six-decimal accounting model. Mainnet will not deploy MockUSD.</p></Section>;
}

function AssetFact({label, value, detail}: {label: string; value: string; detail: string}) {
  return <div className="min-w-0 bg-paper-white p-5 sm:p-6"><p className="text-caption text-fog">{label}</p><p className="mt-2 font-heading text-heading-sm text-obsidian" style={{fontWeight: 400}}>{value}</p><p className="mt-2 break-all font-mono text-[12px] text-fog">{detail}</p></div>;
}
