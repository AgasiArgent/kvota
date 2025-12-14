'use client';

import React, { useState, useEffect } from 'react';
import { Newspaper, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

dayjs.locale('ru');

interface NewsItem {
  slug: string;
  title: string;
  date: string;
  content?: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState<string | null>(null);

  // Fetch news index
  useEffect(() => {
    async function fetchNews() {
      try {
        const response = await fetch('/news/index.json');
        if (!response.ok) throw new Error('Failed to fetch news index');
        const data: NewsItem[] = await response.json();
        // Sort by date descending
        data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setNews(data);

        // Auto-expand first item
        if (data.length > 0) {
          setExpandedSlug(data[0].slug);
          loadContent(data[0].slug);
        }
      } catch (error) {
        console.error('Failed to load news:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  // Load markdown content for a news item
  const loadContent = async (slug: string) => {
    // Check if already loaded
    const existingItem = news.find((n) => n.slug === slug);
    if (existingItem?.content) return;

    setLoadingContent(slug);
    try {
      const response = await fetch(`/news/${slug}.md`);
      if (!response.ok) throw new Error('Failed to fetch content');
      const markdown = await response.text();

      // Extract content after frontmatter (after second ---)
      const parts = markdown.split('---');
      const content = parts.length >= 3 ? parts.slice(2).join('---').trim() : markdown;

      setNews((prev) => prev.map((item) => (item.slug === slug ? { ...item, content } : item)));
    } catch (error) {
      console.error('Failed to load content:', error);
    } finally {
      setLoadingContent(null);
    }
  };

  // Toggle expansion
  const toggleExpand = (slug: string) => {
    if (expandedSlug === slug) {
      setExpandedSlug(null);
    } else {
      setExpandedSlug(slug);
      loadContent(slug);
    }
  };

  // Check if item is recent (within 7 days)
  const isRecent = (date: string) => {
    return dayjs().diff(dayjs(date), 'day') <= 7;
  };

  // Simple markdown to HTML converter (basic)
  const renderMarkdown = (content: string) => {
    if (!content) return null;

    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let inList = false;

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul
            key={`list-${elements.length}`}
            className="list-disc list-inside space-y-1 text-foreground/80 ml-2"
          >
            {listItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Headers
      if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-base font-semibold text-foreground mt-4 mb-2">
            {trimmed.slice(3)}
          </h3>
        );
        inList = false;
      } else if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <h4 key={index} className="text-sm font-semibold text-foreground/90 mt-3 mb-1">
            {trimmed.slice(4)}
          </h4>
        );
        inList = false;
      }
      // List items
      else if (trimmed.startsWith('- ')) {
        inList = true;
        listItems.push(trimmed.slice(2));
      }
      // Numbered list
      else if (/^\d+\.\s/.test(trimmed)) {
        flushList();
        elements.push(
          <p key={index} className="text-foreground/80 ml-2">
            {trimmed}
          </p>
        );
        inList = false;
      }
      // Regular paragraph
      else if (trimmed.length > 0) {
        flushList();
        elements.push(
          <p key={index} className="text-foreground/80 leading-relaxed">
            {trimmed}
          </p>
        );
        inList = false;
      }
      // Empty line
      else if (!inList && listItems.length === 0) {
        elements.push(<div key={index} className="h-2" />);
      }
    });

    flushList();
    return <div className="space-y-1">{elements}</div>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader title="Новости" description="Обновления и новые возможности системы" />

        {/* News List */}
        <div className="space-y-4">
          {loading ? (
            // Skeleton loading
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardHeader className="pb-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/4 mt-2" />
                </CardHeader>
              </Card>
            ))
          ) : news.length === 0 ? (
            // Empty state
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Newspaper className="mx-auto h-12 w-12 text-foreground/20 mb-4" />
                <p className="text-foreground/40">Пока нет новостей</p>
              </CardContent>
            </Card>
          ) : (
            // News items
            news.map((item) => {
              const isExpanded = expandedSlug === item.slug;
              const recent = isRecent(item.date);

              return (
                <Card
                  key={item.slug}
                  className={cn(
                    'bg-card border-border transition-all duration-200',
                    isExpanded && 'ring-1 ring-border'
                  )}
                >
                  <CardHeader
                    className="cursor-pointer select-none pb-3"
                    onClick={() => toggleExpand(item.slug)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                          {item.title}
                          {recent && (
                            <Badge variant="secondary" className="gap-1.5 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Новое
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-2 text-sm text-foreground/50">
                          <Calendar className="h-3.5 w-3.5" />
                          {dayjs(item.date).format('D MMMM YYYY')}
                        </div>
                      </div>
                      <div className="text-foreground/40">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <div className="border-t border-border/50 pt-4">
                        {loadingContent === item.slug ? (
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-4/6" />
                          </div>
                        ) : (
                          renderMarkdown(item.content || '')
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </MainLayout>
  );
}
