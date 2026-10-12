"""Verifica a configuração local da equipe, sem rede ou escrita de arquivos."""

from pathlib import Path
import sys
import tomllib


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    config = tomllib.loads((root / ".codex/config.toml").read_text(encoding="utf-8"))
    agents = config.get("agents", {})
    if agents.get("enabled") is not True:
        errors.append("Subagentes precisam estar habilitados.")
    limit = agents.get("max_concurrent_threads_per_session")
    if type(limit) is not int or limit < 1:
        errors.append("O limite de subagentes precisa ser um inteiro positivo.")
    if config.get("approval_policy") != "on-request":
        errors.append("A política do projeto deve permitir aprovação on-request.")
    if config.get("sandbox_mode") != "workspace-write":
        errors.append("O padrão de escrita deve ficar limitado ao workspace.")

    names: dict[str, Path] = {}
    for path in sorted((root / ".codex/agents").glob("*.toml")):
        role = tomllib.loads(path.read_text(encoding="utf-8"))
        for key in ("name", "description", "developer_instructions"):
            if not isinstance(role.get(key), str) or not role[key].strip():
                errors.append(f"{path.name}: campo obrigatório inválido: {key}.")
        name = role.get("name")
        if isinstance(name, str):
            if name in names:
                errors.append(f"Nome duplicado: {name} em {path.name}.")
            names[name] = path
        if role.get("sandbox_mode") not in ("read-only", "workspace-write"):
            errors.append(f"{path.name}: sandbox fora dos padrões da equipe.")
        if "model" in role or "model_reasoning_effort" in role:
            errors.append(f"{path.name}: o plano aprovado usa modelo/effort herdados.")

    expected = {
        "flowmind_architect", "flowmind_backend", "flowmind_frontend",
        "flowmind_ai", "flowmind_automation", "flowmind_qa_security",
        "flowmind_devops",
    }
    if set(names) != expected:
        errors.append(f"Perfis ausentes: {sorted(expected - set(names))}; extras: {sorted(set(names) - expected)}.")
    architect = names.get("flowmind_architect")
    if architect:
        role = tomllib.loads(architect.read_text(encoding="utf-8"))
        if role.get("sandbox_mode") != "read-only":
            errors.append("O arquiteto consultivo precisa declarar read-only.")
    for relative in (
        "AGENTS.md", "README.md", "docs/PROJECT_CONTEXT.md",
        "docs/AGENT_TEAM.md", "docs/CODEX_USAGE.md",
    ):
        if not (root / relative).is_file():
            errors.append(f"Documento ausente: {relative}.")
    return errors


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    root = Path(__file__).resolve().parent.parent
    try:
        errors = validate(root)
    except (OSError, tomllib.TOMLDecodeError) as exc:
        print(f"FALHA: {exc}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"FALHA: {error}", file=sys.stderr)
        return 1
    print("OK: 7 perfis TOML válidos; nomes únicos; permissões declaradas e documentação verificadas.")
    print("Pendente neste comando: reconhecimento pelo Codex, permissões efetivas e comportamento dos agentes/skills.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
