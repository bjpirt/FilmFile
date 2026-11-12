import type { ApiClient } from '@filmfile/contracts/client';
import type { SelectionRule } from '@filmfile/contracts/selections';
import { useState } from 'react';
import { MenuButton } from '../menu-button.tsx';
import { ChoiceList } from './choice-list.tsx';
import {
  choiceOf,
  choicesLeft,
  isLimitDate,
  newRule,
  ruleLabels,
  type RuleChoice,
} from './selection-edit.ts';
import { useRuleOptions } from './use-rule-options.ts';

type DateKind = 'shot-after' | 'shot-before';

const stars = [1, 2, 3, 4, 5] as const;

/**
 * The rules of a selection: "Add a rule ▾" offers each kind once, each rule
 * has the control that suits it and its own "Remove", and a frame must meet
 * them all. The rules it holds are always ones the service accepts: a date
 * being typed is kept here until it's a real one.
 */
export function RuleEditor({
  api,
  rules,
  change,
}: {
  readonly api: ApiClient;
  readonly rules: readonly SelectionRule[];
  readonly change: (rules: readonly SelectionRule[]) => void;
}) {
  const options = useRuleOptions(api);
  // What's typed in a date, which may not be a date yet.
  const [drafts, setDrafts] = useState<
    Readonly<Partial<Record<DateKind, string | undefined>>>
  >({});

  const pendingDates = (['shot-after', 'shot-before'] as const).filter(
    (kind) =>
      drafts[kind] !== undefined && !rules.some((rule) => rule.kind === kind),
  );

  function add(choice: RuleChoice) {
    const rule = newRule(choice);
    if (rule.kind === 'shot-after' || rule.kind === 'shot-before') {
      setDrafts({ ...drafts, [rule.kind]: '' });
      return;
    }
    change([...rules, rule]);
  }

  function replace(choice: RuleChoice, rule: SelectionRule) {
    change(rules.map((r) => (choiceOf(r) === choice ? rule : r)));
  }

  function remove(choice: RuleChoice) {
    if (choice === 'shot-after' || choice === 'shot-before') {
      setDrafts({ ...drafts, [choice]: undefined });
    }
    change(rules.filter((r) => choiceOf(r) !== choice));
  }

  function typeDate(kind: DateKind, text: string) {
    setDrafts({ ...drafts, [kind]: text });
    const others = rules.filter((r) => r.kind !== kind);
    change(isLimitDate(text) ? [...others, { kind, date: text }] : others);
  }

  // Draft-only date rules are listed with the rules in the order they were added.
  const listed: readonly RuleChoice[] = [
    ...rules.map(choiceOf),
    ...pendingDates,
  ];
  const menu = choicesLeft([...rules, ...pendingDates.map(newRule)]);

  function control(choice: RuleChoice) {
    const rule = rules.find((r) => choiceOf(r) === choice);
    const label = ruleLabels[choice];
    switch (rule?.kind) {
      case 'rating':
        return (
          <label>
            {label}
            <select
              value={rule.atLeast}
              onChange={(event) => {
                const atLeast = stars.find(
                  (n) => String(n) === event.target.value,
                );
                if (atLeast !== undefined) {
                  replace(choice, { kind: 'rating', atLeast });
                }
              }}
            >
              {stars.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1 star' : `${String(n)} stars`}
                </option>
              ))}
            </select>
          </label>
        );
      case 'event':
        return (
          <ChoiceList
            legend={label}
            options={options.events}
            chosen={rule.events}
            change={(events) => {
              replace(choice, { kind: 'event', events: [...events] });
            }}
          />
        );
      case 'roll':
        return (
          <ChoiceList
            legend={label}
            options={options.rolls}
            chosen={rule.rolls}
            change={(rolls) => {
              replace(choice, { kind: 'roll', rolls: [...rolls] });
            }}
          />
        );
      case 'camera':
        return (
          <ChoiceList
            legend={label}
            options={options.cameras}
            chosen={rule.cameras}
            change={(cameras) => {
              replace(choice, { kind: 'camera', cameras: [...cameras] });
            }}
          />
        );
      case 'lens':
        return (
          <ChoiceList
            legend={label}
            options={options.lenses}
            chosen={rule.lenses}
            change={(lenses) => {
              replace(choice, { kind: 'lens', lenses: [...lenses] });
            }}
          />
        );
      case 'film':
        return (
          <ChoiceList
            legend={label}
            options={options.films}
            chosen={rule.films}
            change={(films) => {
              replace(choice, { kind: 'film', films: [...films] });
            }}
          />
        );
      case 'has':
        return <span>{label}</span>;
      case 'shot-after':
      case 'shot-before':
      case undefined:
        return dateControl(choice);
    }
  }

  function dateControl(choice: RuleChoice) {
    if (choice !== 'shot-after' && choice !== 'shot-before') {
      return null;
    }
    const rule = rules.find((r) => r.kind === choice);
    const text = drafts[choice] ?? (rule?.kind === choice ? rule.date : '');
    const bad = text !== '' && !isLimitDate(text);
    return (
      <div className="rule-date">
        <label>
          {ruleLabels[choice]}
          <input
            type="text"
            value={text}
            placeholder="2026-09"
            aria-invalid={bad}
            onChange={(event) => {
              typeDate(choice, event.target.value);
            }}
          />
        </label>
        {bad && (
          <span role="alert">
            Use a year, month or day: 2026, 2026-09 or 2026-09-14.
          </span>
        )}
        {text === '' && <span>Type a year, month or day.</span>}
      </div>
    );
  }

  return (
    <div className="rule-editor">
      <ul className="rules">
        {listed.map((choice) => (
          <li key={choice} className="rule">
            {control(choice)}
            <button
              type="button"
              aria-label={`Remove rule: ${ruleLabels[choice]}`}
              onClick={() => {
                remove(choice);
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {menu.length > 0 && (
        <MenuButton
          label="Add a rule ▾"
          items={menu.map((choice) => ({
            label: ruleLabels[choice],
            select: () => {
              add(choice);
            },
          }))}
        />
      )}
    </div>
  );
}
